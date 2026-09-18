"""
Agent-First ERP — FastAPI Local Server (Phase 1)
Exposes all REST endpoints + WebSocket for streaming chat.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
from typing import Any, Optional

# Make all backend packages importable
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.local"))

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db.models import (
    get_conn,
    create_conversation,
    list_conversations,
    get_conversation,
    get_conversation_messages,
    save_message,
    update_conversation,
    delete_conversation,
)
from agents import master_agent, inventory_agent
from confirmation.pending_action import (
    list_pending_actions,
    get_pending_action,
    confirm_pending_action,
    reject_pending_action,
)
from tools.get_stock import get_stock
from tools.get_low_stock import get_low_stock
from tools.get_cash_position import get_cash_position
from tools.get_expense_summary import get_expense_summary
from tools.run_report import run_report, get_executive_kpis
from tools.add_customer import add_customer
from tools.manual_entry import (
    create_item,
    update_item,
    adjust_stock_direct,
    update_entity,
    create_vendor,
    create_sale_direct,
    create_po_direct,
)
from confirmation.crypto_ledger import verify_audit_chain, compute_entry_delta
from common.settings_manager import get_settings, update_settings, get_gateway_statuses
from agents.fleet_manager import list_workspaces, create_workspace, switch_workspace, get_fleet_telemetry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Agent-First ERP API",
    description="Phase 1 local FastAPI backend for AgentERP",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connected WebSocket clients for proactive alerts
_ws_clients: list[WebSocket] = []


# ---------------------------------------------------------------------------
# Startup / Shutdown
# ---------------------------------------------------------------------------
_event_loop: asyncio.AbstractEventLoop | None = None

@app.on_event("startup")
async def startup():
    """Start inventory background poller and register proactive callback."""
    global _event_loop
    _event_loop = asyncio.get_running_loop()

    def push_proactive(alert: dict):
        """Broadcast proactive alert to all connected WebSocket clients."""
        if _event_loop and not _event_loop.is_closed():
            asyncio.run_coroutine_threadsafe(_broadcast(alert), _event_loop)

    inventory_agent.set_proactive_callback(push_proactive)
    inventory_agent.start_background_poller()
    logger.info("AgentERP local server started ✓")


async def _broadcast(message: dict):
    """Broadcast a JSON message to all connected WebSocket clients."""
    dead = []
    for ws in _ws_clients:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.remove(ws)


# ---------------------------------------------------------------------------
# Pydantic request models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    conversation_id: Optional[str] = None


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = "New Conversation"
    workspace_id: Optional[str] = None
    active_agent: Optional[str] = "master"


class ConversationUpdateRequest(BaseModel):
    title: Optional[str] = None
    active_agent: Optional[str] = None


class RejectRequest(BaseModel):
    reason: Optional[str] = ""


class AddCustomerRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class UpdateEntityRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class CreateVendorRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class CreateItemRequest(BaseModel):
    sku: str
    name: str
    unit_cost: float = 0
    unit_price: float = 0
    quantity_on_hand: int = 0
    reorder_threshold: int = 0
    category: Optional[str] = None
    description: Optional[str] = None


class UpdateItemRequest(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    unit_cost: Optional[float] = None
    unit_price: Optional[float] = None
    quantity_on_hand: Optional[int] = None
    reorder_threshold: Optional[int] = None
    category: Optional[str] = None
    description: Optional[str] = None


class AdjustStockRequest(BaseModel):
    delta: int
    reason: str


class TxnLineRequest(BaseModel):
    item_id: str
    quantity: int
    unit_price: Optional[float] = None
    unit_cost: Optional[float] = None


class CreateSaleRequest(BaseModel):
    customer_id: str
    items: list[TxnLineRequest]


class CreatePORequest(BaseModel):
    vendor_id: str
    items: list[TxnLineRequest]


class ModelLoadRequest(BaseModel):
    model: str
    config: Optional[dict] = None


class ModelUnloadRequest(BaseModel):
    instance_id: str


class WorkspaceCreateRequest(BaseModel):
    name: str
    currency: Optional[str] = "USD"
    env: Optional[str] = "Staging"


class SettingsUpdateRequest(BaseModel):
    sign_off_limit: Optional[float] = None
    daily_cap: Optional[float] = None
    auto_replenish: Optional[bool] = None
    polling_freq: Optional[int] = None


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok", "service": "AgentERP Phase 1"}


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------
@app.post("/chat")
async def chat(req: ChatRequest):
    """
    Main agent endpoint. Routes to specialist via master_agent.
    Persists multi-turn conversations and message history in PostgreSQL.
    Returns full agent response including pending_action, chart_spec, domain_focus, and conversation_id.
    """
    try:
        # Determine or create conversation session
        conv_id = req.conversation_id
        if not conv_id:
            first_line = req.message.strip().split("\n")[0]
            clean_title = re.sub(r"^@\w+\s*", "", first_line).strip()
            title = clean_title[:45] if clean_title else "New Conversation"
            if len(clean_title) > 45:
                title += "…"
            new_conv = create_conversation(title=title)
            conv_id = new_conv["id"]
        else:
            existing = get_conversation(conv_id)
            if not existing:
                create_conversation(title="Conversation", active_agent="master")
            elif existing["title"] in ("New Conversation", "Conversation"):
                first_line = req.message.strip().split("\n")[0]
                clean_title = re.sub(r"^@\w+\s*", "", first_line).strip()
                if clean_title:
                    update_conversation(conv_id, title=clean_title[:45] + ("…" if len(clean_title) > 45 else ""))

        # Save user message to PostgreSQL
        save_message(conv_id, "user", req.message)

        # Run master_agent in thread
        result = await asyncio.to_thread(
            master_agent.run,
            req.message,
            req.history,
        )

        # Broadcast to WS clients if there's a pending action
        if result.get("pending_action_id"):
            await _broadcast({
                "type":   "new_pending_action",
                "id":     result["pending_action_id"],
                "agent":  result.get("agent", "unknown"),
            })

        # Prepare metadata for assistant message
        metadata = {}
        if result.get("chart_spec"):
            metadata["chart_spec"] = result["chart_spec"]
        if result.get("domain_focus"):
            metadata["domain_focus"] = result["domain_focus"]
        if result.get("affected_items"):
            metadata["affected_items"] = result["affected_items"]
        if result.get("tool_results"):
            metadata["tool_results"] = result["tool_results"]

        # Save assistant message to PostgreSQL
        save_message(
            conv_id,
            "assistant",
            result.get("content", ""),
            agent=result.get("agent", "master"),
            pending_action_id=result.get("pending_action_id"),
            metadata=metadata,
        )

        result["conversation_id"] = conv_id
        return result
    except Exception as exc:
        logger.exception("Chat endpoint error")
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Conversation endpoints
# ---------------------------------------------------------------------------
@app.get("/conversations")
def get_conversations(workspace_id: Optional[str] = None):
    return {"ok": True, "conversations": list_conversations(workspace_id)}


@app.post("/conversations")
def create_new_conversation(req: ConversationCreateRequest):
    conv = create_conversation(
        title=req.title or "New Conversation",
        workspace_id=req.workspace_id,
        active_agent=req.active_agent or "master",
    )
    return {"ok": True, "conversation": conv}


@app.get("/conversations/{conv_id}")
def get_single_conversation(conv_id: str):
    conv = get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = get_conversation_messages(conv_id)
    return {"ok": True, "conversation": conv, "messages": msgs}


@app.patch("/conversations/{conv_id}")
def patch_conversation(conv_id: str, req: ConversationUpdateRequest):
    updated = update_conversation(conv_id, title=req.title, active_agent=req.active_agent)
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found or not modified")
    return {"ok": True, "conversation": get_conversation(conv_id)}


@app.delete("/conversations/{conv_id}")
def remove_conversation(conv_id: str):
    deleted = delete_conversation(conv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True, "deleted": conv_id}


# ---------------------------------------------------------------------------
# WebSocket for real-time updates
# ---------------------------------------------------------------------------
@app.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket):
    """WebSocket endpoint — receives chat messages, broadcasts proactive alerts."""
    await websocket.accept()
    _ws_clients.append(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg = data.get("message", "")
            history = data.get("history", [])

            result = await asyncio.to_thread(master_agent.run, msg, history)

            await websocket.send_json({
                "type":    "chat_response",
                **result,
            })

            if result.get("pending_action_id"):
                await _broadcast({
                    "type":  "new_pending_action",
                    "id":    result["pending_action_id"],
                    "agent": result.get("agent"),
                })
    except WebSocketDisconnect:
        _ws_clients.remove(websocket)
    except Exception as exc:
        logger.exception("WebSocket error")
        try:
            _ws_clients.remove(websocket)
        except ValueError:
            pass


# ---------------------------------------------------------------------------
# Pending Actions
# ---------------------------------------------------------------------------
@app.get("/pending-actions")
def list_pending():
    result = list_pending_actions()
    if not result.get("ok"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result


@app.get("/pending-actions/{pending_id}")
def get_pending(pending_id: str):
    result = get_pending_action(pending_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@app.post("/pending-actions/{pending_id}/confirm")
async def confirm_action(pending_id: str):
    result = await asyncio.to_thread(confirm_pending_action, pending_id)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    # Broadcast confirmation to all WS clients
    await _broadcast({"type": "action_confirmed", "id": pending_id})
    return result


@app.post("/pending-actions/{pending_id}/reject")
async def reject_action(pending_id: str, req: RejectRequest):
    result = await asyncio.to_thread(reject_pending_action, pending_id, req.reason or "")
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    await _broadcast({"type": "action_rejected", "id": pending_id})
    return result


# ---------------------------------------------------------------------------
# Inventory endpoints
# ---------------------------------------------------------------------------
@app.get("/inventory")
def get_inventory():
    return get_stock()


@app.get("/inventory/low-stock")
def get_low_stock_items():
    return get_low_stock()


# ---------------------------------------------------------------------------
# Finance endpoints
# ---------------------------------------------------------------------------
@app.get("/finance/cash")
def get_cash():
    return get_cash_position()


@app.get("/finance/expenses")
def get_expenses(period_days: int = 30):
    return get_expense_summary(period_days=period_days)


@app.get("/finance/ledger")
def get_ledger(limit: int = 50, account: Optional[str] = None):
    """Get recent ledger entries, optionally filtered by account."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                if account:
                    cur.execute(
                        """
                        SELECT l.id, l.transaction_id, l.entry_type, l.account, l.amount,
                               l.description, l.created_at,
                               e.name AS entity_name, t.type AS tx_type
                        FROM ledger l
                        LEFT JOIN transactions t ON l.transaction_id = t.id
                        LEFT JOIN entities e ON t.entity_id = e.id
                        WHERE l.account = %s
                        ORDER BY l.created_at DESC LIMIT %s
                        """,
                        (account, limit),
                    )
                else:
                    cur.execute(
                        """
                        SELECT l.id, l.transaction_id, l.entry_type, l.account, l.amount,
                               l.description, l.created_at,
                               e.name AS entity_name, t.type AS tx_type
                        FROM ledger l
                        LEFT JOIN transactions t ON l.transaction_id = t.id
                        LEFT JOIN entities e ON t.entity_id = e.id
                        ORDER BY l.created_at DESC LIMIT %s
                        """,
                        (limit,),
                    )
                rows = cur.fetchall()

        return {
            "ok": True,
            "entries": [
                {
                    "id":          str(r["id"]),
                    "entry_type":  r["entry_type"],
                    "account":     r["account"],
                    "amount":      float(r["amount"]),
                    "description": r["description"],
                    "entity_name": r["entity_name"],
                    "tx_type":     r["tx_type"],
                    "created_at":  r["created_at"].isoformat() if r["created_at"] else None,
                }
                for r in rows
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Customers endpoints
# ---------------------------------------------------------------------------
@app.get("/customers")
def get_customers():
    """Get all customers."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT e.id, e.name, e.email, e.phone, e.address, e.created_at,
                           COUNT(t.id) AS order_count,
                           COALESCE(SUM(t.total_amount), 0) AS total_billed
                    FROM entities e
                    LEFT JOIN transactions t ON t.entity_id = e.id AND t.type = 'sale' AND t.status = 'confirmed'
                    WHERE e.type = 'customer'
                    GROUP BY e.id, e.name, e.email, e.phone, e.address, e.created_at
                    ORDER BY total_billed DESC
                    """
                )
                rows = cur.fetchall()

        return {
            "ok": True,
            "customers": [
                {
                    "id":           str(r["id"]),
                    "name":         r["name"],
                    "email":        r["email"],
                    "phone":        r["phone"],
                    "address":      r["address"],
                    "order_count":  int(r["order_count"]),
                    "total_billed": float(r["total_billed"]),
                    "created_at":   r["created_at"].isoformat() if r["created_at"] else None,
                }
                for r in rows
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/customers/{customer_id}/history")
def customer_history(customer_id: str):
    from tools.get_customer_history import get_customer_history
    result = get_customer_history(customer_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@app.post("/customers")
def create_customer(req: AddCustomerRequest):
    result = add_customer(name=req.name, email=req.email, phone=req.phone,
                          address=req.address)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.put("/customers/{customer_id}")
def edit_customer(customer_id: str, req: UpdateEntityRequest):
    result = update_entity(customer_id, "customer",
                           {k: v for k, v in req.model_dump().items() if v is not None})
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ---------------------------------------------------------------------------
# Manual entry — inventory
# ---------------------------------------------------------------------------
@app.post("/inventory")
def create_inventory_item(req: CreateItemRequest):
    result = create_item(**req.model_dump())
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.patch("/inventory/{item_id}")
def edit_inventory_item(item_id: str, req: UpdateItemRequest):
    result = update_item(item_id,
                         {k: v for k, v in req.model_dump().items() if v is not None})
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/inventory/{item_id}/adjust")
def adjust_inventory_item(item_id: str, req: AdjustStockRequest):
    result = adjust_stock_direct(item_id, req.delta, req.reason)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    await_broadcast = {"type": "action_confirmed", "id": item_id}
    try:
        import asyncio as _aio
        loop = _aio.get_event_loop()
        if loop.is_running():
            _aio.ensure_future(_broadcast(await_broadcast))
    except Exception:
        pass
    return result


# ---------------------------------------------------------------------------
# Manual entry — sales & purchase orders (direct save, actor='user')
# ---------------------------------------------------------------------------
@app.post("/sales")
def create_sale(req: CreateSaleRequest):
    result = create_sale_direct(req.customer_id, [l.model_dump() for l in req.items])
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/purchase-orders")
def create_po(req: CreatePORequest):
    result = create_po_direct(req.vendor_id, [l.model_dump() for l in req.items])
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ---------------------------------------------------------------------------
# Reports endpoints
# ---------------------------------------------------------------------------
@app.get("/reports/kpis")
def get_kpis_endpoint():
    result = get_executive_kpis()
    if not result.get("ok"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result


@app.get("/reports/{report_type}")
def get_report(report_type: str):
    result = run_report(report_type)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ---------------------------------------------------------------------------
# Audit Log & Cryptographic Verification
# ---------------------------------------------------------------------------
@app.get("/audit-log")
def get_audit_log(limit: int = 100):
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, pending_action_id, actor, action, detail, created_at, prev_hash, entry_hash
                    FROM audit_log
                    ORDER BY created_at DESC LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()

        entries = []
        for r in rows:
            delta = compute_entry_delta(r)
            entries.append({
                "id":                str(r["id"]),
                "pending_action_id": str(r["pending_action_id"]) if r["pending_action_id"] else None,
                "actor":             r["actor"],
                "action":            r["action"],
                "detail":            r["detail"],
                "created_at":        r["created_at"].isoformat() if r["created_at"] else None,
                "prev_hash":         r.get("prev_hash"),
                "entry_hash":        r.get("entry_hash"),
                "delta":             delta,
            })

        return {"ok": True, "entries": entries}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/audit-log/verify")
def verify_audit():
    """Verify entire SHA-256 DAG hash chain and compute current Merkle root."""
    return verify_audit_chain()


# ---------------------------------------------------------------------------
# Workspaces & Fleet Endpoints
# ---------------------------------------------------------------------------
@app.get("/workspaces")
def get_workspaces_endpoint():
    result = list_workspaces()
    if not result.get("ok"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result


@app.post("/workspaces")
def create_workspace_endpoint(req: WorkspaceCreateRequest):
    result = create_workspace(name=req.name, currency=req.currency or "USD", env=req.env or "Staging")
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/workspaces/{workspace_id}/switch")
def switch_workspace_endpoint(workspace_id: str):
    result = switch_workspace(workspace_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@app.get("/workspaces/fleet")
def get_fleet_telemetry_endpoint():
    result = get_fleet_telemetry()
    if not result.get("ok"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result


# ---------------------------------------------------------------------------
# Settings & Vendor Gateway Endpoints
# ---------------------------------------------------------------------------
@app.get("/settings")
def get_settings_endpoint():
    result = get_settings()
    if not result.get("ok"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result


@app.post("/settings")
def update_settings_endpoint(req: SettingsUpdateRequest):
    result = update_settings(
        sign_off_limit=req.sign_off_limit,
        daily_cap=req.daily_cap,
        auto_replenish=req.auto_replenish,
        polling_freq=req.polling_freq,
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.get("/settings/gateways")
def get_gateways_endpoint():
    return {"ok": True, "gateways": get_gateway_statuses()}


# ---------------------------------------------------------------------------
# Vendors
# ---------------------------------------------------------------------------
@app.get("/vendors")
def get_vendors():
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, name, email, phone, address FROM entities WHERE type = 'vendor' ORDER BY name"
                )
                rows = cur.fetchall()
        return {
            "ok": True,
            "vendors": [
                {"id": str(r["id"]), "name": r["name"], "email": r["email"], "phone": r["phone"], "address": r["address"]}
                for r in rows
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/vendors")
def create_vendor_endpoint(req: CreateVendorRequest):
    result = create_vendor(**req.model_dump())
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.put("/vendors/{vendor_id}")
def edit_vendor(vendor_id: str, req: UpdateEntityRequest):
    result = update_entity(vendor_id, "vendor",
                           {k: v for k, v in req.model_dump().items() if v is not None})
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ---------------------------------------------------------------------------
# LM Studio v1 Model Management Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/models")
def get_models():
    """List available and currently loaded models from LM Studio native v1 API."""
    from agents.model_client import list_models, get_loaded_models, get_active_model_id
    all_models = list_models()
    loaded_models = get_loaded_models()
    active_model = get_active_model_id()
    return {
        "ok": True,
        "active_model": active_model,
        "loaded_models": loaded_models,
        "models": all_models,
    }


@app.post("/api/models/load")
def load_model_endpoint(req: ModelLoadRequest):
    """Load a model in LM Studio via POST /api/v1/models/load."""
    from agents.model_client import load_model
    try:
        result = load_model(req.model, req.config)
        return {"ok": True, "result": result}
    except Exception as exc:
        logger.error("Failed to load model %s: %s", req.model, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/models/unload")
def unload_model_endpoint(req: ModelUnloadRequest):
    """Unload a model instance from LM Studio via POST /api/v1/models/unload."""
    from agents.model_client import unload_model
    try:
        result = unload_model(req.instance_id)
        return {"ok": True, "result": result}
    except Exception as exc:
        logger.error("Failed to unload model instance %s: %s", req.instance_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/models/download/status")
def download_status_endpoint():
    """Check LM Studio model download status via GET /api/v1/models/download/status."""
    from agents.model_client import get_download_status
    try:
        result = get_download_status()
        return {"ok": True, "result": result}
    except Exception as exc:
        logger.error("Failed to get download status: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("local_server:app", host="0.0.0.0", port=8000, reload=True, log_level="info")

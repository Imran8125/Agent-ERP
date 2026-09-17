"""
Agent-First ERP — FastAPI Local Server (Phase 1)
Exposes all REST endpoints + WebSocket for streaming chat.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
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

from db.models import get_conn
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
from tools.run_report import run_report
from tools.add_customer import add_customer

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


class RejectRequest(BaseModel):
    reason: Optional[str] = ""


class AddCustomerRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class ModelLoadRequest(BaseModel):
    model: str
    config: Optional[dict] = None


class ModelUnloadRequest(BaseModel):
    instance_id: str


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
    Returns full agent response including any pending_action.
    """
    try:
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
        return result
    except Exception as exc:
        logger.exception("Chat endpoint error")
        raise HTTPException(status_code=500, detail=str(exc))


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
    result = add_customer(name=req.name, email=req.email, phone=req.phone)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ---------------------------------------------------------------------------
# Reports endpoints
# ---------------------------------------------------------------------------
@app.get("/reports/{report_type}")
def get_report(report_type: str):
    result = run_report(report_type)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ---------------------------------------------------------------------------
# Audit Log
# ---------------------------------------------------------------------------
@app.get("/audit-log")
def get_audit_log(limit: int = 100):
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, pending_action_id, actor, action, detail, created_at
                    FROM audit_log
                    ORDER BY created_at DESC LIMIT %s
                    """,
                    (limit,),
                )
                rows = cur.fetchall()

        return {
            "ok": True,
            "entries": [
                {
                    "id":                str(r["id"]),
                    "pending_action_id": str(r["pending_action_id"]) if r["pending_action_id"] else None,
                    "actor":             r["actor"],
                    "action":            r["action"],
                    "detail":            r["detail"],
                    "created_at":        r["created_at"].isoformat() if r["created_at"] else None,
                }
                for r in rows
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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

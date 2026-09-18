"""
Inventory Agent — handles stock queries, low-stock alerts, and manual adjustments.
Tools: get_stock, get_low_stock, adjust_stock
Proactive: polls for low stock and fires alerts.
"""
from __future__ import annotations
import logging
import threading
import time
from typing import Any, Callable, Optional

from agents.model_client import chat_with_tools
from tools.get_stock import get_stock, TOOL_SCHEMA as GET_STOCK_SCHEMA
from tools.get_low_stock import get_low_stock, TOOL_SCHEMA as LOW_STOCK_SCHEMA
from tools.adjust_stock import adjust_stock, TOOL_SCHEMA as ADJUST_SCHEMA

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Inventory Agent for AgentERP, an AI-first ERP system.
You monitor warehouse stock levels and help users manage inventory.

Your capabilities:
- Query current stock levels by item name or SKU
- Find all items below reorder threshold
- Propose manual stock adjustments (corrections, write-offs)

Key rules:
- NEVER directly write to inventory. All adjustments go through pending_actions for confirmation.
- For stock adjustments or queries, you can identify items directly by SKU (e.g. 'SKU-2081'), item name, or UUID. NEVER ask the human user to provide an internal item UUID!
- When showing stock data, be specific: mention SKU, current quantity, threshold, and status.
- Flag critical shortages with urgency.
- Currency is Indian Rupee (₹).
- Be concise. Tables and bullet lists are preferred for stock data.
"""

TOOLS = [GET_STOCK_SCHEMA, LOW_STOCK_SCHEMA, ADJUST_SCHEMA]

TOOL_DISPATCH = {
    "get_stock":    lambda args: get_stock(**args),
    "get_low_stock": lambda args: get_low_stock(**args),
    "adjust_stock": lambda args: adjust_stock(**args),
}

# ---------------------------------------------------------------------------
# Proactive polling (background thread)
# ---------------------------------------------------------------------------

_proactive_callback: Optional[Callable[[dict], None]] = None
_last_low_stock_count: int = -1
_poller_started: bool = False
_poller_lock = threading.Lock()


def set_proactive_callback(callback: Callable[[dict], None]) -> None:
    """Register a callback to receive proactive alert messages."""
    global _proactive_callback
    _proactive_callback = callback


def _poll_low_stock() -> None:
    global _last_low_stock_count
    while True:
        try:
            result = get_low_stock()
            if result.get("ok"):
                count = result["count"]
                if count > 0 and count != _last_low_stock_count:
                    _last_low_stock_count = count
                    items = result["items"]
                    names = ", ".join(i["name"] for i in items[:3])
                    if count > 3:
                        names += f" (+{count - 3} more)"
                    alert_message = {
                        "type":    "proactive_alert",
                        "agent":   "inventory_agent",
                        "content": (
                            f"⚠️ **Low Stock Alert** — {count} item{'s' if count != 1 else ''} "
                            f"below reorder threshold: {names}. "
                            "Shall I draft a purchase order?"
                        ),
                        "items": items,
                    }
                    if _proactive_callback:
                        _proactive_callback(alert_message)
                    logger.info("Inventory proactive alert fired: %d low-stock items", count)
        except Exception as exc:
            logger.debug("Low-stock poll error: %s", exc)
        time.sleep(30)


def start_background_poller() -> None:
    """Start the proactive low-stock poller thread (once only)."""
    global _poller_started
    with _poller_lock:
        if not _poller_started:
            t = threading.Thread(target=_poll_low_stock, daemon=True, name="inventory-poller")
            t.start()
            _poller_started = True
            logger.info("Inventory background poller started")


# ---------------------------------------------------------------------------
# Main agent run
# ---------------------------------------------------------------------------

def run(messages: list[dict]) -> dict[str, Any]:
    """
    Run the inventory agent with the given message history.
    Returns: {"content": str, "tool_results": [...], "pending_action_id": str|None}
    """
    tool_results = []
    pending_action_id = None

    for _ in range(5):
        response = chat_with_tools(
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            tools=TOOLS,
            agent_name="inventory_agent",
        )

        if response["tool_calls"]:
            for tc in response["tool_calls"]:
                tool_name = tc["name"]
                tool_args = tc["arguments"]

                dispatch_fn = TOOL_DISPATCH.get(tool_name)
                if dispatch_fn is None:
                    result = {"ok": False, "error": f"Unknown tool: {tool_name}"}
                else:
                    result = dispatch_fn(tool_args)
                    logger.info("[inventory_agent] %s → ok=%s", tool_name, result.get("ok"))
                    if result.get("ok") and "pending_action_id" in result:
                        pending_action_id = result["pending_action_id"]

                tool_results.append({"tool": tool_name, "result": result})
                messages = messages + [
                    {"role": "assistant", "content": f"[Tool call: {tool_name}]"},
                    {"role": "user",      "content": f"Tool result: {result}"},
                ]
        else:
            return {
                "content":          response["content"] or "",
                "tool_results":     tool_results,
                "pending_action_id": pending_action_id,
                "agent":            "inventory_agent",
            }

    return {
        "content":          "Inventory analysis complete. Please review the data above.",
        "tool_results":     tool_results,
        "pending_action_id": pending_action_id,
        "agent":            "inventory_agent",
    }

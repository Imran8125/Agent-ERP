"""
Procurement Agent — handles vendor POs, stock receiving, and email notifications.
Tools: create_purchase_order, receive_stock, get_stock, send_email
"""
from __future__ import annotations
import logging
from typing import Any

from agents.model_client import chat_with_tools
from tools.create_purchase_order import create_purchase_order, TOOL_SCHEMA as CREATE_PO_SCHEMA
from tools.receive_stock import receive_stock, TOOL_SCHEMA as RECEIVE_SCHEMA
from tools.get_stock import get_stock, TOOL_SCHEMA as GET_STOCK_SCHEMA
from tools.send_email import send_email, TOOL_SCHEMA as EMAIL_SCHEMA
from tools.get_low_stock import get_low_stock, TOOL_SCHEMA as LOW_STOCK_SCHEMA
from tools.get_vendors import get_vendors, TOOL_SCHEMA as VENDOR_SCHEMA

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Procurement Agent for AgentERP, an AI-first ERP system.
You handle all vendor procurement operations: creating purchase orders, receiving stock, and vendor notifications.

Your capabilities:
- Check current inventory levels and low stock status (`get_stock`, `get_low_stock`)
- Search and list available suppliers/vendors (`get_vendors`)
- Create purchase orders from vendors (requires user confirmation)
- Mark purchase orders as received (requires user confirmation)
- Send notification emails to vendors or internal teams

Key rules:
- ALL writes (`create_purchase_order`, `receive_stock`) go through pending_actions and REQUIRE user confirmation. You never execute them directly.
- When creating a PO, you can identify items by SKU (e.g. 'SKU-2081', 'SKU-1042'), name, or UUID.
- VENDOR RESOLUTION RULE: NEVER ask the human user to provide a vendor ID or list of vendor IDs!
  1. Always look up active vendors using `get_vendors()` or match by vendor name (e.g., 'ABC Supplies', 'Valvetech Industries', 'AeroClean Filtration Corp', 'Polymer Seals Ltd').
  2. If the user specifies a vendor name like "Acme Supplies" or "ABC Supplies", pass `vendor_name="Acme Supplies"`. The system will automatically link it.
  3. If the user doesn't specify a vendor, pass `vendor_name='ABC Supplies'` (the primary general supplier).
- UNIT COST & PRICING: `unit_cost` is OPTIONAL when drafting a PO. If the user didn't specify a price, do NOT ask for it — call `create_purchase_order` without `unit_cost` (or check `get_stock`); the system automatically fills the catalog unit cost from inventory!
- PROACTIVE PO DRAFTING: When the user asks to order items or draft a PO (e.g., "Order 200 industrial filters from Acme Supplies", "Draft PO for low stock"), IMMEDIATELY call `create_purchase_order`. Never delay or ask unnecessary clarifying questions if you have the item and quantity.
- Multi-step PO drafting workflow:
  1. When asked to restock or draft a PO for low stock items, first call `get_low_stock()` to identify the items needing restock.
  2. Call `create_purchase_order()` with the items list (each with sku or item_id, and quantity) and the selected vendor (e.g. `vendor_name='ABC Supplies'`).
- Respond in concise, professional language. Summarize the items, quantities, unit costs, and total. The user will see a rich interactive Purchase Order approval card in the UI.
- Currency is Indian Rupee (₹).
"""

TOOLS = [CREATE_PO_SCHEMA, RECEIVE_SCHEMA, GET_STOCK_SCHEMA, LOW_STOCK_SCHEMA, EMAIL_SCHEMA, VENDOR_SCHEMA]

TOOL_DISPATCH = {
    "create_purchase_order": lambda args: create_purchase_order(**args),
    "receive_stock":         lambda args: receive_stock(**args),
    "get_stock":             lambda args: get_stock(**args),
    "get_low_stock":         lambda args: get_low_stock(**args),
    "send_email":            lambda args: send_email(**args),
    "get_vendors":           lambda args: get_vendors(**args),
}


def run(messages: list[dict]) -> dict[str, Any]:
    """
    Run the procurement agent with the given message history.
    Returns: {"content": str, "tool_results": [...], "pending_action_id": str|None}
    """
    tool_results = []
    pending_action_id = None

    # Agentic loop (max 5 turns)
    for _ in range(5):
        response = chat_with_tools(
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            tools=TOOLS,
            agent_name="procurement_agent",
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
                    logger.info("[procurement_agent] %s → ok=%s", tool_name, result.get("ok"))

                    if result.get("ok") and "pending_action_id" in result:
                        pending_action_id = result["pending_action_id"]

                tool_results.append({"tool": tool_name, "result": result})

                # Append tool result to message history for multi-turn
                messages = messages + [
                    {"role": "assistant", "content": f"[Tool call: {tool_name}]"},
                    {"role": "user",      "content": f"Tool result: {result}"},
                ]
        else:
            # No more tool calls — agent has a final response
            return {
                "content":          response["content"] or "",
                "tool_results":     tool_results,
                "pending_action_id": pending_action_id,
                "agent":            "procurement_agent",
            }

    return {
        "content":          "I've processed your request. Please review the proposed actions.",
        "tool_results":     tool_results,
        "pending_action_id": pending_action_id,
        "agent":            "procurement_agent",
    }

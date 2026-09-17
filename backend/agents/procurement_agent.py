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

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Procurement Agent for AgentERP, an AI-first ERP system.
You handle all vendor procurement operations: creating purchase orders, receiving stock, and vendor notifications.

Your capabilities:
- Check current inventory levels and low stock status
- Create purchase orders from vendors (requires user confirmation)
- Mark purchase orders as received (requires user confirmation)
- Send notification emails to vendors or internal teams

Key rules:
- ALL writes (create_purchase_order, receive_stock) go through pending_actions and REQUIRE user confirmation. You never execute them directly.
- When creating a PO, always verify item IDs first using get_stock.
- Respond in concise, professional language. State what you're proposing, not what you're doing.
- Currency is Indian Rupee (₹).
- After calling a write tool, always explain what the user needs to confirm.
"""

TOOLS = [CREATE_PO_SCHEMA, RECEIVE_SCHEMA, GET_STOCK_SCHEMA, LOW_STOCK_SCHEMA, EMAIL_SCHEMA]

TOOL_DISPATCH = {
    "create_purchase_order": lambda args: create_purchase_order(**args),
    "receive_stock":         lambda args: receive_stock(**args),
    "get_stock":             lambda args: get_stock(**args),
    "get_low_stock":         lambda args: get_low_stock(**args),
    "send_email":            lambda args: send_email(**args),
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

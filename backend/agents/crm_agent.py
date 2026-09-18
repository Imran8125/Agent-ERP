"""
CRM Agent — manages customers and sales logging.
Tools: add_customer, get_customer_history, log_sale, get_stock
"""
from __future__ import annotations
import logging
from typing import Any

from agents.model_client import chat_with_tools
from tools.add_customer import add_customer, TOOL_SCHEMA as ADD_CUST_SCHEMA
from tools.get_customer_history import get_customer_history, TOOL_SCHEMA as HIST_SCHEMA
from tools.log_sale import log_sale, TOOL_SCHEMA as SALE_SCHEMA
from tools.get_stock import get_stock, TOOL_SCHEMA as STOCK_SCHEMA
from tools.get_customers import get_customers, TOOL_SCHEMA as CUST_SCHEMA

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the CRM Agent for AgentERP, an AI-first ERP system.
You manage customer relationships and sales transactions.

Your capabilities:
- Look up and search customers using get_customers
- Look up customer transaction history and purchase volume using get_customer_history
- Add new customers to the system (auto-executes — low risk)
- Log sales to customers (requires user confirmation)
- Check item stock before logging a sale

Key rules:
- CUSTOMER RESOLUTION RULE: NEVER ask the user to provide a customer ID or UUID!
  1. If the user mentions a customer by name (e.g. "Apex Industrial", "Apex", "Zenith"), immediately call get_customer_history with customer_id or customer_name set to that company name. The tool will auto-resolve it.
  2. If you need to search or list customers, call get_customers().
- log_sale goes through pending_actions and REQUIRES confirmation. Always explain this to the user.
- add_customer executes immediately (no confirmation needed).
- When logging a sale, always check stock first using get_stock to confirm availability.
- Refer to customers by company name in your responses. Summarize lifetime spend, orders, and recent transactions clearly.
- Currency is Indian Rupee (₹).
- Be professional, warm, and helpful in tone.
"""

TOOLS = [ADD_CUST_SCHEMA, HIST_SCHEMA, SALE_SCHEMA, STOCK_SCHEMA, CUST_SCHEMA]

TOOL_DISPATCH = {
    "add_customer":         lambda args: add_customer(**args),
    "get_customer_history": lambda args: get_customer_history(**args),
    "log_sale":             lambda args: log_sale(**args),
    "get_stock":            lambda args: get_stock(**args),
    "get_customers":        lambda args: get_customers(**args),
}


def run(messages: list[dict]) -> dict[str, Any]:
    tool_results = []
    pending_action_id = None

    for _ in range(6):
        response = chat_with_tools(
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            tools=TOOLS,
            agent_name="crm_agent",
        )

        if response["tool_calls"]:
            for tc in response["tool_calls"]:
                tool_name = tc["name"]
                dispatch_fn = TOOL_DISPATCH.get(tool_name)
                result = dispatch_fn(tc["arguments"]) if dispatch_fn else {"ok": False, "error": f"Unknown tool: {tool_name}"}
                logger.info("[crm_agent] %s → ok=%s", tool_name, result.get("ok"))
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
                "agent":            "crm_agent",
            }

    return {
        "content":          "CRM operation complete.",
        "tool_results":     tool_results,
        "pending_action_id": pending_action_id,
        "agent":            "crm_agent",
    }

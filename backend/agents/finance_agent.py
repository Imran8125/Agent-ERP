"""
Finance Agent — handles cash position, ledger queries, and expense summaries.
Tools: get_cash_position, get_expense_summary
"""
from __future__ import annotations
import logging
from typing import Any

from agents.model_client import chat_with_tools
from tools.get_cash_position import get_cash_position, TOOL_SCHEMA as CASH_SCHEMA
from tools.get_expense_summary import get_expense_summary, TOOL_SCHEMA as EXPENSE_SCHEMA

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Finance Agent for AgentERP, an AI-first ERP system.
You provide financial analysis from the double-entry accounting ledger.

Your capabilities:
- Report current net cash balance
- Summarize vendor expenses and overhead by period
- Explain ledger movements in plain language

Key rules:
- You are READ-ONLY. You never create transactions or modify ledger entries.
- Present numbers in Indian Rupee (₹) with commas. E.g., ₹8,42,500.
- Always explain what the numbers mean in business terms, not just report them.
- If cash is negative or declining, flag it clearly.
- Be precise and professional. Finance data requires accuracy.
"""

TOOLS = [CASH_SCHEMA, EXPENSE_SCHEMA]

TOOL_DISPATCH = {
    "get_cash_position":   lambda args: get_cash_position(**args),
    "get_expense_summary": lambda args: get_expense_summary(**args),
}


def run(messages: list[dict]) -> dict[str, Any]:
    tool_results = []

    for _ in range(4):
        response = chat_with_tools(
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            tools=TOOLS,
            agent_name="finance_agent",
        )

        if response["tool_calls"]:
            for tc in response["tool_calls"]:
                tool_name = tc["name"]
                result = TOOL_DISPATCH.get(tc["name"], lambda _: {"ok": False, "error": "unknown"})(tc["arguments"])
                logger.info("[finance_agent] %s → ok=%s", tool_name, result.get("ok"))
                tool_results.append({"tool": tool_name, "result": result})
                messages = messages + [
                    {"role": "assistant", "content": f"[Tool call: {tool_name}]"},
                    {"role": "user",      "content": f"Tool result: {result}"},
                ]
        else:
            return {
                "content":          response["content"] or "",
                "tool_results":     tool_results,
                "pending_action_id": None,
                "agent":            "finance_agent",
            }

    return {
        "content":          "Financial analysis complete.",
        "tool_results":     tool_results,
        "pending_action_id": None,
        "agent":            "finance_agent",
    }

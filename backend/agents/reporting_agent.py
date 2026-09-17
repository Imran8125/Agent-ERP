"""
Reporting Agent — generates chart-ready analytics reports.
Tools: run_report
"""
from __future__ import annotations
import logging
from typing import Any

from agents.model_client import chat_with_tools
from tools.run_report import run_report, TOOL_SCHEMA as REPORT_SCHEMA

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Reporting Agent for AgentERP, an AI-first ERP system.
You generate business analytics reports and interpret them in plain language.

Your capabilities:
- Generate sales trend (30-day) chart data
- Rank top customers by revenue
- Break down inventory value by category

Key rules:
- You are READ-ONLY. You only generate report data — never modify anything.
- After running a report, always provide a 2-3 sentence business interpretation in plain language.
- Highlight key insights: top performers, trends, anomalies.
- Currency is Indian Rupee (₹).
- If the user asks for a report type you don't support, suggest the closest available one.
"""

TOOLS = [REPORT_SCHEMA]

TOOL_DISPATCH = {
    "run_report": lambda args: run_report(**args),
}


def run(messages: list[dict]) -> dict[str, Any]:
    tool_results = []

    for _ in range(3):
        response = chat_with_tools(
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            tools=TOOLS,
            agent_name="reporting_agent",
        )

        if response["tool_calls"]:
            for tc in response["tool_calls"]:
                tool_name = tc["name"]
                result = TOOL_DISPATCH.get(tool_name, lambda _: {"ok": False})(tc["arguments"])
                logger.info("[reporting_agent] %s → ok=%s", tool_name, result.get("ok"))
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
                "agent":            "reporting_agent",
            }

    return {
        "content":          "Report generated.",
        "tool_results":     tool_results,
        "pending_action_id": None,
        "agent":            "reporting_agent",
    }

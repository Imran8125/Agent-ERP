"""
Reporting Agent — generates chart-ready analytics reports.
Tools: run_report
"""
from __future__ import annotations
import logging
from typing import Any

from agents.model_client import chat_with_tools
from tools.run_report import run_report, TOOL_SCHEMA as REPORT_SCHEMA
from tools.dynamic_analytics import run_dynamic_analytics, TOOL_SCHEMA as DYNAMIC_SCHEMA

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Reporting Agent for AgentERP, an AI-first ERP system.
You generate business analytics reports and interpret them in plain language.

Your capabilities:
- Generate dynamic charts and graphs based on user queries using `run_dynamic_analytics` or `run_report`.
- Dynamically select the best chart type ('bar', 'line', 'area', 'pie') for the data.
- Analyze sales trends, customer distribution, category valuations, and expenses.
- Always provide a 2-3 sentence business takeaway in plain language interpreting the results.

Key rules:
- You are strictly READ-ONLY. You only query and aggregate data — never modify anything.
- For flexible chart requests or custom comparisons, call `run_dynamic_analytics` with the appropriate `chart_type`, `title`, and query description or SQL.
- Currency is Indian Rupee (₹).
"""

TOOLS = [REPORT_SCHEMA, DYNAMIC_SCHEMA]

TOOL_DISPATCH = {
    "run_report":            lambda args: run_report(**args),
    "run_dynamic_analytics": lambda args: run_dynamic_analytics(**args),
}


def _extract_chart_spec(tool_results: list[dict]) -> Optional[dict]:
    """Find or convert chart_spec from tool results."""
    for tr in tool_results:
        res = tr.get("result", {})
        if "chart_spec" in res:
            return res["chart_spec"]
        if tr.get("tool") == "run_report" and res.get("ok"):
            rep_type = res.get("report_type")
            if rep_type == "sales_trend":
                return {
                    "chart_type": "area",
                    "title": "30-Day Sales Revenue Trend",
                    "description": "Normalized daily revenue run-rate across cleared transactions",
                    "labels": res.get("labels", []),
                    "values": res.get("values", []),
                    "summary_metrics": [
                        {"label": "30d Total", "value": f"₹{res.get('summary', {}).get('total_30d', 0):,.2f}"},
                        {"label": "Daily Average", "value": f"₹{res.get('summary', {}).get('avg_daily', 0):,.2f}"},
                        {"label": "Peak Day", "value": f"{res.get('summary', {}).get('peak_label', '—')} (₹{res.get('summary', {}).get('peak_value', 0):,.2f})"},
                    ],
                    "takeaway": f"Daily run-rate averages ₹{res.get('summary', {}).get('avg_daily', 0):,.2f}, peaking on {res.get('summary', {}).get('peak_label', '—')}.",
                }
            elif rep_type == "top_customers":
                return {
                    "chart_type": "bar",
                    "title": "Top Client Accounts by Revenue",
                    "description": "Ranked by historical cleared ledger volume",
                    "labels": res.get("labels", []),
                    "values": res.get("values", []),
                    "summary_metrics": [
                        {"label": "Top Account", "value": res.get("labels", ["—"])[0] if res.get("labels") else "—"},
                        {"label": "Active Accounts", "value": str(len(res.get("labels", [])))},
                    ],
                    "takeaway": "Leading customer accounts drive primary recurring business volume.",
                }
            elif rep_type == "inventory_value":
                return {
                    "chart_type": "pie",
                    "title": "Inventory Valuation by Category",
                    "description": "Capital allocation across product categories",
                    "labels": res.get("labels", []),
                    "values": res.get("values", []),
                    "summary_metrics": [
                        {"label": "Total Warehouse Capital", "value": f"₹{res.get('total_value', 0):,.2f}"},
                        {"label": "Active Categories", "value": str(len(res.get("categories", [])))},
                    ],
                    "takeaway": f"Total warehouse assets valued at ₹{res.get('total_value', 0):,.2f}.",
                }
    return None


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
                dispatch_fn = TOOL_DISPATCH.get(tool_name)
                if dispatch_fn:
                    result = dispatch_fn(tc["arguments"])
                else:
                    result = {"ok": False, "error": f"Unknown tool {tool_name}"}
                logger.info("[reporting_agent] %s → ok=%s", tool_name, result.get("ok"))
                tool_results.append({"tool": tool_name, "result": result})
                messages = messages + [
                    {"role": "assistant", "content": f"[Tool call: {tool_name}]"},
                    {"role": "user",      "content": f"Tool result: {result}"},
                ]
        else:
            chart_spec = _extract_chart_spec(tool_results)
            return {
                "content":          response["content"] or "",
                "tool_results":     tool_results,
                "pending_action_id": None,
                "chart_spec":       chart_spec,
                "agent":            "reporting_agent",
            }

    chart_spec = _extract_chart_spec(tool_results)
    return {
        "content":          "Report generated.",
        "tool_results":     tool_results,
        "pending_action_id": None,
        "chart_spec":       chart_spec,
        "agent":            "reporting_agent",
    }

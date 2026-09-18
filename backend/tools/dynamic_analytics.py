"""
dynamic_analytics — dynamic business reporting and chart generation tool.
Executes read-only analytical aggregations across ledger, items, transactions,
and entities, returning chart-ready schemas for Recharts visualization.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from db.models import get_conn
from common.errors import ok, err

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "run_dynamic_analytics",
        "description": (
            "Generate dynamic business charts and analytical graphs from ERP data. "
            "Supports arbitrary read-only SQL aggregations and pre-built analytical query types. "
            "Returns chart_spec with chart_type ('bar', 'line', 'area', 'pie'), labels, values, summary metrics, and plain-English takeaway."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "line", "area", "pie"],
                    "description": "Recommended chart visualization type.",
                },
                "title": {
                    "type": "string",
                    "description": "Concise human-readable title for the chart.",
                },
                "description": {
                    "type": "string",
                    "description": "One-line description of the data series.",
                },
                "query_type": {
                    "type": "string",
                    "description": "High-level report type or 'custom_sql'. Examples: 'sales_by_period', 'inventory_by_category', 'expense_breakdown', 'top_customers', 'custom_sql'.",
                },
                "custom_sql": {
                    "type": "string",
                    "description": "Optional custom read-only SELECT query for specific aggregations. Must return at least two columns: label (string/date) and value (numeric).",
                },
                "takeaway": {
                    "type": "string",
                    "description": "1-2 sentence business insight interpreting the chart results in plain English.",
                },
            },
            "required": ["chart_type", "title"],
        },
    },
}

FORBIDDEN_SQL_PATTERNS = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|execute|copy|vacuum)\b",
    re.IGNORECASE,
)


def _validate_sql(sql: str) -> Optional[str]:
    """Ensure SQL is strictly read-only and safe."""
    trimmed = sql.strip().rstrip(";")
    if not (trimmed.lower().startswith("select") or trimmed.lower().startswith("with")):
        return "Query must start with SELECT or WITH."
    if FORBIDDEN_SQL_PATTERNS.search(trimmed):
        return "Only read-only SELECT queries are permitted."
    if ";" in trimmed:
        return "Multiple SQL statements are not permitted."
    return None


def run_dynamic_analytics(
    chart_type: str = "bar",
    title: str = "Analytics Report",
    description: str = "",
    query_type: str = "custom_sql",
    custom_sql: Optional[str] = None,
    takeaway: Optional[str] = None,
) -> dict[str, Any]:
    """
    Execute read-only analytics aggregation and produce a standard chart_spec.
    """
    try:
        labels: list[str] = []
        values: list[float] = []
        series_data: list[dict] = []
        summary_metrics: list[dict] = []

        # If custom_sql is provided, execute it
        if custom_sql:
            sql_err = _validate_sql(custom_sql)
            if sql_err:
                return err(sql_err)

            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(custom_sql)
                    rows = cur.fetchall()

            if not rows:
                return ok({
                    "chart_spec": {
                        "chart_type": chart_type,
                        "title": title,
                        "description": description or "No data recorded for query period.",
                        "labels": ["No Data"],
                        "values": [0],
                        "summary_metrics": [{"label": "Status", "value": "Zero Records"}],
                        "takeaway": takeaway or "No matching transactions or records found in the database.",
                    }
                })

            col_keys = list(rows[0].keys())
            label_col = col_keys[0]
            val_col = col_keys[1] if len(col_keys) > 1 else col_keys[0]

            for r in rows:
                lbl = str(r[label_col] if r[label_col] is not None else "Unknown")
                try:
                    val = float(r[val_col]) if r[val_col] is not None else 0.0
                except (ValueError, TypeError):
                    val = 0.0
                labels.append(lbl)
                values.append(round(val, 2))

        else:
            # Predefined query templates based on query_type
            q = query_type.lower()
            with get_conn() as conn:
                with conn.cursor() as cur:
                    if "expense" in q or "cost" in q:
                        cur.execute(
                            """
                            SELECT COALESCE(description, account) AS label, SUM(amount) AS value
                            FROM ledger
                            WHERE account = 'expense' AND entry_type = 'debit'
                            GROUP BY label ORDER BY value DESC LIMIT 8;
                            """
                        )
                    elif "category" in q or "stock" in q or "inventory" in q:
                        cur.execute(
                            """
                            SELECT COALESCE(category, 'Uncategorized') AS label,
                                   SUM(quantity_on_hand * unit_cost) AS value
                            FROM items
                            GROUP BY label ORDER BY value DESC;
                            """
                        )
                    elif "customer" in q or "client" in q:
                        cur.execute(
                            """
                            SELECT e.name AS label, SUM(t.total_amount) AS value
                            FROM transactions t
                            JOIN entities e ON t.entity_id = e.id
                            WHERE t.type = 'sale' AND t.status = 'confirmed'
                            GROUP BY e.name ORDER BY value DESC LIMIT 8;
                            """
                        )
                    else:
                        # Default to 30-day sales trend
                        cur.execute(
                            """
                            SELECT date_trunc('day', created_at)::date::text AS label,
                                   COALESCE(SUM(amount), 0) AS value
                            FROM ledger
                            WHERE account = 'revenue' AND entry_type = 'credit'
                              AND created_at >= now() - interval '30 days'
                            GROUP BY label ORDER BY label ASC;
                            """
                        )
                    rows = cur.fetchall()

            for r in rows:
                labels.append(str(r["label"]))
                values.append(round(float(r["value"] or 0), 2))

        # Calculate summary metrics
        total_val = sum(values)
        avg_val = total_val / len(values) if values else 0
        peak_idx = values.index(max(values)) if values else -1
        peak_lbl = labels[peak_idx] if peak_idx >= 0 else "—"
        peak_val = values[peak_idx] if peak_idx >= 0 else 0

        summary_metrics = [
            {"label": "Aggregated Total", "value": f"₹{total_val:,.2f}"},
            {"label": "Average", "value": f"₹{avg_val:,.2f}"},
            {"label": "Peak Segment", "value": f"{peak_lbl} (₹{peak_val:,.2f})"},
        ]

        if not takeaway:
            if peak_idx >= 0:
                takeaway = f"Operational takeaway: Total aggregated value is ₹{total_val:,.2f}, driven predominantly by {peak_lbl} (₹{peak_val:,.2f})."
            else:
                takeaway = "Operational takeaway: Analytics dataset compiled from active ledger."

        chart_spec = {
            "chart_type": chart_type,
            "title": title,
            "description": description or f"Live telemetry query generated at {datetime.now(timezone.utc).strftime('%H:%M UTC')}",
            "labels": labels,
            "values": values,
            "summary_metrics": summary_metrics,
            "takeaway": takeaway,
        }

        return ok({"chart_spec": chart_spec})

    except Exception as exc:
        logger.exception("Dynamic analytics query failed")
        return err(f"Dynamic analytics query failed: {exc}")

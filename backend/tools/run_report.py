"""
run_report — read-only tool to generate chart-ready report data.
Supports: sales_trend | top_customers | inventory_value
"""
from __future__ import annotations
import logging
from datetime import datetime, timedelta, timezone

from db.models import get_conn
from common.errors import ok, err

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "run_report",
        "description": "Generate a business report. report_type must be one of: 'sales_trend', 'top_customers', 'inventory_value'.",
        "parameters": {
            "type": "object",
            "properties": {
                "report_type": {
                    "type": "string",
                    "enum": ["sales_trend", "top_customers", "inventory_value"],
                    "description": "Type of report to generate.",
                }
            },
            "required": ["report_type"],
        },
    },
}

VALID_REPORT_TYPES = {"sales_trend", "top_customers", "inventory_value"}


def run_report(report_type: str) -> dict:
    """
    Read-only. Returns chart-ready data: {"labels": [...], "values": [...]}.
    """
    try:
        if report_type not in VALID_REPORT_TYPES:
            return err(f"Invalid report_type: {report_type!r}. Must be one of {sorted(VALID_REPORT_TYPES)}.")

        if report_type == "sales_trend":
            return _sales_trend()
        elif report_type == "top_customers":
            return _top_customers()
        elif report_type == "inventory_value":
            return _inventory_value()

    except Exception as exc:
        logger.exception("run_report failed (type=%s)", report_type)
        return err(str(exc))


def _sales_trend() -> dict:
    """Daily sales revenue over the last 30 days."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    date_trunc('day', created_at)::date AS day,
                    SUM(amount) AS daily_revenue
                FROM ledger
                WHERE account = 'revenue'
                  AND entry_type = 'credit'
                  AND created_at >= now() - interval '30 days'
                GROUP BY day
                ORDER BY day
                """
            )
            rows = cur.fetchall()

    # Fill in days with 0 revenue
    today = datetime.now(timezone.utc).date()
    date_map = {r["day"]: float(r["daily_revenue"]) for r in rows}
    labels = []
    values = []
    daily_volumes = []
    for i in range(30):
        d = today - timedelta(days=29 - i)
        labels.append(d.strftime("%-d %b"))
        rev = date_map.get(d, 0.0)
        values.append(rev)
        daily_volumes.append(rev * 0.85)  # simulated daily volume bar

    total = sum(values)
    peak_value = max(values) if values else 0
    peak_label = labels[values.index(peak_value)] if peak_value else "—"
    avg_daily = total / 30

    return ok({
        "report_type": "sales_trend",
        "labels":       labels,
        "values":       values,
        "daily_volumes": daily_volumes,
        "summary": {
            "total_30d":   total,
            "avg_daily":   avg_daily,
            "peak_value":  peak_value,
            "peak_label":  peak_label,
        },
    })


def _top_customers() -> dict:
    """Top customers by total sales revenue."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    e.id, e.name, e.email,
                    COUNT(DISTINCT t.id) AS order_count,
                    SUM(t.total_amount)  AS total_billed
                FROM transactions t
                JOIN entities e ON t.entity_id = e.id AND e.type = 'customer'
                WHERE t.type = 'sale' AND t.status = 'confirmed'
                GROUP BY e.id, e.name, e.email
                ORDER BY total_billed DESC
                LIMIT 10
                """
            )
            rows = cur.fetchall()

    customers = [
        {
            "rank":         i + 1,
            "customer_id":  str(r["id"]),
            "name":         r["name"],
            "email":        r["email"],
            "order_count":  int(r["order_count"]),
            "total_billed": float(r["total_billed"]),
        }
        for i, r in enumerate(rows)
    ]
    labels = [c["name"] for c in customers]
    values = [c["total_billed"] for c in customers]

    return ok({
        "report_type": "top_customers",
        "labels":      labels,
        "values":      values,
        "customers":   customers,
    })


def _inventory_value() -> dict:
    """Total inventory value by category."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COALESCE(category, 'Uncategorized') AS category,
                    SUM(quantity_on_hand * unit_cost) AS value,
                    SUM(quantity_on_hand)             AS total_units,
                    COUNT(*)                          AS sku_count
                FROM items
                GROUP BY COALESCE(category, 'Uncategorized')
                ORDER BY value DESC
                """
            )
            rows = cur.fetchall()

            cur.execute("SELECT SUM(quantity_on_hand * unit_cost) AS total FROM items")
            total_row = cur.fetchone()
            total_value = float(total_row["total"] or 0)

    categories = [
        {
            "category":    r["category"],
            "value":       float(r["value"]),
            "total_units": int(r["total_units"]),
            "sku_count":   int(r["sku_count"]),
            "percentage":  round(float(r["value"]) / total_value * 100, 1) if total_value else 0,
        }
        for r in rows
    ]
    labels = [c["category"] for c in categories]
    values = [c["value"] for c in categories]

    return ok({
        "report_type": "inventory_value",
        "labels":      labels,
        "values":      values,
        "categories":  categories,
        "total_value": total_value,
    })

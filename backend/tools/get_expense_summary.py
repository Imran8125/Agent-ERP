"""
get_expense_summary — read-only tool to summarize expense ledger entries.
Groups by vendor/description over a rolling period.
"""
from __future__ import annotations
import logging
from typing import Optional

from db.models import get_conn
from common.errors import ok, err

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_expense_summary",
        "description": "Get a summary of expenses (vendor outflows and overhead) grouped by vendor over a rolling period.",
        "parameters": {
            "type": "object",
            "properties": {
                "period_days": {
                    "type": "integer",
                    "description": "Number of past days to include. Default is 30.",
                    "default": 30,
                }
            },
            "required": [],
        },
    },
}


def get_expense_summary(period_days: int = 30) -> dict:
    """
    Read-only. Groups expense+inventory-credit entries by vendor over the period.
    Returns: {"ok": True, "period_days": int, "total_expenses": float, "vendors": [...]}
    """
    try:
        if not isinstance(period_days, int) or period_days <= 0:
            period_days = 30

        with get_conn() as conn:
            with conn.cursor() as cur:
                # Expense ledger entries
                cur.execute(
                    """
                    SELECT
                        COALESCE(e.name, l.description, 'Other') AS vendor_name,
                        SUM(l.amount) AS total,
                        COUNT(*) AS entry_count
                    FROM ledger l
                    LEFT JOIN transactions t ON l.transaction_id = t.id
                    LEFT JOIN entities e ON t.entity_id = e.id AND e.type = 'vendor'
                    WHERE l.account IN ('expense', 'inventory')
                      AND l.entry_type = 'debit'
                      AND l.created_at >= now() - (%s || ' days')::interval
                    GROUP BY COALESCE(e.name, l.description, 'Other')
                    ORDER BY total DESC
                    """,
                    (str(period_days),),
                )
                rows = cur.fetchall()

                vendors = [
                    {
                        "vendor_name":  r["vendor_name"],
                        "total":        float(r["total"]),
                        "entry_count":  int(r["entry_count"]),
                    }
                    for r in rows
                ]
                total_expenses = sum(v["total"] for v in vendors)

        return ok({
            "period_days":    period_days,
            "total_expenses": total_expenses,
            "vendors":        vendors,
        })

    except Exception as exc:
        logger.exception("get_expense_summary failed")
        return err(str(exc))

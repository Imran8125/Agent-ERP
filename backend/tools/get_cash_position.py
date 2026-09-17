"""
get_cash_position — read-only tool to sum the ledger 'cash' account.
"""
from __future__ import annotations
import logging

from db.models import get_conn
from common.errors import ok, err

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_cash_position",
        "description": "Get the current cash position by summing all cash account ledger entries (debits minus credits).",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
}


def get_cash_position() -> dict:
    """
    Read-only. Sums ledger 'cash' account debits and credits.
    Returns: {"ok": True, "cash_balance": float, "total_debits": float, "total_credits": float}
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        SUM(CASE WHEN entry_type = 'debit'  THEN amount ELSE 0 END) AS total_debits,
                        SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END) AS total_credits
                    FROM ledger
                    WHERE account = 'cash'
                    """
                )
                row = cur.fetchone()
                total_debits  = float(row["total_debits"]  or 0)
                total_credits = float(row["total_credits"] or 0)
                cash_balance  = total_debits - total_credits

                # Recent cash movements for context
                cur.execute(
                    """
                    SELECT l.entry_type, l.amount, l.description, l.created_at
                    FROM ledger l
                    WHERE l.account = 'cash'
                    ORDER BY l.created_at DESC
                    LIMIT 10
                    """
                )
                recent = [
                    {
                        "entry_type":  r["entry_type"],
                        "amount":      float(r["amount"]),
                        "description": r["description"],
                        "created_at":  r["created_at"].isoformat() if r["created_at"] else None,
                    }
                    for r in cur.fetchall()
                ]

        return ok({
            "cash_balance":  cash_balance,
            "total_debits":  total_debits,
            "total_credits": total_credits,
            "recent_movements": recent,
        })

    except Exception as exc:
        logger.exception("get_cash_position failed")
        return err(str(exc))

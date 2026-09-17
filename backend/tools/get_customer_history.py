"""
get_customer_history — read-only tool to fetch transaction history for a customer.
"""
from __future__ import annotations
import logging

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_uuid

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_customer_history",
        "description": "Get all transactions and line items for a specific customer.",
        "parameters": {
            "type": "object",
            "properties": {
                "customer_id": {
                    "type": "string",
                    "description": "UUID of the customer entity.",
                }
            },
            "required": ["customer_id"],
        },
    },
}


def get_customer_history(customer_id: str) -> dict:
    """
    Read-only. Returns transactions + line_items for the customer.
    Returns: {"ok": True, "customer": {...}, "transactions": [...]} | {"ok": False, "error": str}
    """
    try:
        require_uuid(customer_id, "customer_id")

        with get_conn() as conn:
            with conn.cursor() as cur:
                # Verify customer exists
                cur.execute(
                    "SELECT id, name, email, phone, address FROM entities WHERE id = %s AND type = 'customer'",
                    (customer_id,),
                )
                cust = cur.fetchone()
                if not cust:
                    return err(f"Customer not found: {customer_id}")

                # Get transactions
                cur.execute(
                    """
                    SELECT t.id, t.type, t.status, t.total_amount, t.created_at, t.confirmed_at
                    FROM transactions t
                    WHERE t.entity_id = %s
                    ORDER BY t.created_at DESC
                    """,
                    (customer_id,),
                )
                tx_rows = cur.fetchall()

                transactions = []
                for t in tx_rows:
                    cur.execute(
                        """
                        SELECT li.quantity, li.unit_price,
                               i.sku, i.name AS item_name
                        FROM line_items li
                        JOIN items i ON li.item_id = i.id
                        WHERE li.transaction_id = %s
                        """,
                        (str(t["id"]),),
                    )
                    line_items = [
                        {
                            "sku":        r["sku"],
                            "item_name":  r["item_name"],
                            "quantity":   r["quantity"],
                            "unit_price": float(r["unit_price"]),
                            "total":      float(r["unit_price"]) * r["quantity"],
                        }
                        for r in cur.fetchall()
                    ]
                    transactions.append({
                        "transaction_id": str(t["id"]),
                        "type":           t["type"],
                        "status":         t["status"],
                        "total_amount":   float(t["total_amount"]),
                        "created_at":     t["created_at"].isoformat() if t["created_at"] else None,
                        "confirmed_at":   t["confirmed_at"].isoformat() if t["confirmed_at"] else None,
                        "line_items":     line_items,
                    })

        return ok({
            "customer": {
                "id":      str(cust["id"]),
                "name":    cust["name"],
                "email":   cust["email"],
                "phone":   cust["phone"],
                "address": cust["address"],
            },
            "transactions": transactions,
        })

    except Exception as exc:
        logger.exception("get_customer_history failed")
        return err(str(exc))

from __future__ import annotations
import logging
import re
from typing import Optional, Any

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_uuid

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_customer_history",
        "description": "Get all transactions, orders, line items, and purchase volume for a specific customer. Supports customer name, keyword, or UUID.",
        "parameters": {
            "type": "object",
            "properties": {
                "customer_id": {
                    "type": "string",
                    "description": "Customer UUID, company name, or keyword (e.g. 'Apex', 'Apex Industrial', 'Zenith Systems'). Auto-resolved.",
                },
                "customer_name": {
                    "type": "string",
                    "description": "Optional company name of the customer (e.g. 'Apex Industrial', 'Zenith Systems', 'Global Automation').",
                },
            },
        },
    },
}


def get_customer_history(
    customer_id: Optional[str] = None,
    customer_name: Optional[str] = None,
    *args,
    **kwargs,
) -> dict:
    """
    Read-only. Returns transactions + line_items + lifetime spend for the customer.
    Supports customer_id (UUID or name) or customer_name.
    """
    try:
        # Resolve identifier
        identifier = customer_name or customer_id
        if not identifier and args and isinstance(args[0], str):
            identifier = args[0]
        if not identifier:
            return err("customer_id or customer_name is required")

        identifier = identifier.strip()

        with get_conn() as conn:
            with conn.cursor() as cur:
                cust = None

                # 1. Try UUID
                try:
                    require_uuid(identifier, "customer_id")
                    cur.execute(
                        "SELECT id, name, email, phone, address FROM entities WHERE id = %s AND type = 'customer'",
                        (identifier,),
                    )
                    cust = cur.fetchone()
                except Exception:
                    pass

                # 2. Try Name exact or ILIKE
                if not cust:
                    cur.execute(
                        "SELECT id, name, email, phone, address FROM entities WHERE type = 'customer' AND name ILIKE %s ORDER BY name LIMIT 1",
                        (f"%{identifier}%",),
                    )
                    cust = cur.fetchone()

                # 3. Try Word tokens (e.g. 'Apex Industrial' -> matches 'Apex Manufacturing Ltd')
                if not cust:
                    clean = re.sub(r"[^\w\s]", " ", identifier)
                    words = [w for w in clean.split() if len(w) > 2 and w.lower() not in ("ltd", "inc", "corp", "co", "llc")]
                    for w in words:
                        cur.execute(
                            "SELECT id, name, email, phone, address FROM entities WHERE type = 'customer' AND name ILIKE %s ORDER BY name LIMIT 1",
                            (f"%{w}%",),
                        )
                        cust = cur.fetchone()
                        if cust:
                            break

                if not cust:
                    return err(f"Customer not found for identifier: {identifier}")

                resolved_id = str(cust["id"])

                # Get transactions
                cur.execute(
                    """
                    SELECT t.id, t.type, t.status, t.total_amount, t.created_at, t.confirmed_at
                    FROM transactions t
                    WHERE t.entity_id = %s
                    ORDER BY t.created_at DESC
                    """,
                    (resolved_id,),
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

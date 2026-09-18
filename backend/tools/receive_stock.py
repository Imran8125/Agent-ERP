"""
receive_stock — proposes receiving a purchase order via pending_actions.
"""
from __future__ import annotations
import json
import logging

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_uuid
from confirmation.crypto_ledger import append_audit_log

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "receive_stock",
        "description": "Propose marking a purchase order as received, incrementing inventory and recording ledger entries. Requires confirmation.",
        "parameters": {
            "type": "object",
            "properties": {
                "transaction_id": {
                    "type": "string",
                    "description": "UUID of the purchase_order transaction to receive.",
                }
            },
            "required": ["transaction_id"],
        },
    },
}


def receive_stock(transaction_id: str) -> dict:
    """
    Validates: transaction exists, type='purchase_order', status='ordered'.
    Proposes: status -> 'received', items.quantity_on_hand += quantities,
              ledger entries (debit inventory, credit cash) — via pending_actions.
    Returns: {"ok": True, "pending_action_id": str, "summary": str} | {"ok": False, "error": str}
    """
    try:
        require_uuid(transaction_id, "transaction_id")

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT t.id, t.status, t.total_amount, t.type, e.name AS vendor_name
                    FROM transactions t
                    LEFT JOIN entities e ON t.entity_id = e.id
                    WHERE t.id = %s
                    """,
                    (transaction_id,),
                )
                tx = cur.fetchone()
                if not tx:
                    return err(f"Transaction not found: {transaction_id}")
                if tx["type"] != "purchase_order":
                    return err("Transaction is not a purchase order.")
                if tx["status"] not in ("ordered", "confirmed"):
                    return err(f"Purchase order must be in 'ordered' or 'confirmed' status, current: {tx['status']}")

                # Fetch line items
                cur.execute(
                    """
                    SELECT li.quantity, li.unit_price, i.sku, i.name AS item_name, i.id AS item_id
                    FROM line_items li
                    JOIN items i ON li.item_id = i.id
                    WHERE li.transaction_id = %s
                    """,
                    (transaction_id,),
                )
                lines = cur.fetchall()
                line_summaries = [f"{l['item_name']} (+{l['quantity']} units)" for l in lines]

                payload = {
                    "transaction_id": transaction_id,
                    "vendor_name":    tx["vendor_name"],
                    "total_amount":   float(tx["total_amount"]),
                    "line_items":     [
                        {
                            "item_id":   str(l["item_id"]),
                            "item_name": l["item_name"],
                            "quantity":  l["quantity"],
                            "unit_price": float(l["unit_price"]),
                        }
                        for l in lines
                    ],
                }
                summary = (
                    f"Receive stock from {tx['vendor_name'] or 'vendor'}: "
                    + ", ".join(line_summaries)
                    + f" — Total: ₹{float(tx['total_amount']):,.2f}"
                )

                cur.execute(
                    """
                    INSERT INTO pending_actions (action_type, payload, summary, proposed_by)
                    VALUES ('receive_stock', %s, %s, 'procurement_agent')
                    RETURNING id
                    """,
                    (json.dumps(payload), summary),
                )
                pending_id = str(cur.fetchone()["id"])

                append_audit_log(
                    cur,
                    actor="procurement_agent",
                    action="proposed",
                    pending_action_id=pending_id,
                    detail={
                        "transaction_id": transaction_id,
                        "line_items": payload["line_items"],
                        "summary": summary,
                    },
                )

        return ok({"pending_action_id": pending_id, "summary": summary})

    except Exception as exc:
        logger.exception("receive_stock failed")
        return err(str(exc))

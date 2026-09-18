"""
log_sale — proposes recording a sale via pending_actions (requires confirmation).
"""
from __future__ import annotations
import json
import logging

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_uuid, validate_items_list
from confirmation.crypto_ledger import append_audit_log

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "log_sale",
        "description": "Propose logging a sale to a customer. Validates stock availability. Requires confirmation.",
        "parameters": {
            "type": "object",
            "properties": {
                "customer_id": {
                    "type": "string",
                    "description": "UUID of the customer entity.",
                },
                "items": {
                    "type": "array",
                    "description": "Items sold: [{item_id, quantity, unit_price?}]",
                    "items": {
                        "type": "object",
                        "properties": {
                            "item_id":    {"type": "string"},
                            "quantity":   {"type": "integer"},
                            "unit_price": {"type": "number"},
                        },
                        "required": ["item_id", "quantity"],
                    },
                },
            },
            "required": ["customer_id", "items"],
        },
    },
}


def log_sale(customer_id: str, items: list[dict]) -> dict:
    """
    Validates: customer exists (type='customer'), sufficient quantity_on_hand for each item.
    Proposes: transaction(type='sale'), line_items, ledger (debit cash, credit revenue),
              items.quantity_on_hand -= quantity — via pending_actions.
    Returns: {"ok": True, "pending_action_id": str, "summary": str, "total_amount": float}
    """
    try:
        require_uuid(customer_id, "customer_id")
        validate_items_list(items)

        with get_conn() as conn:
            with conn.cursor() as cur:
                # Validate customer
                cur.execute(
                    "SELECT id, name, email FROM entities WHERE id = %s AND type = 'customer'",
                    (customer_id,),
                )
                customer = cur.fetchone()
                if not customer:
                    return err(f"Customer not found: {customer_id}")

                # Validate items and stock availability
                validated_items = []
                total_amount = 0.0
                item_summaries = []
                for item in items:
                    cur.execute(
                        "SELECT id, sku, name, unit_price, quantity_on_hand FROM items WHERE id = %s",
                        (item["item_id"],),
                    )
                    db_item = cur.fetchone()
                    if not db_item:
                        return err(f"Item not found: {item['item_id']}")

                    qty = item["quantity"]
                    if db_item["quantity_on_hand"] < qty:
                        return err(
                            f"Insufficient stock for {db_item['name']} (SKU: {db_item['sku']}): "
                            f"requested {qty}, available {db_item['quantity_on_hand']}"
                        )

                    unit_price = float(item.get("unit_price") or db_item["unit_price"])
                    line_total = unit_price * qty
                    total_amount += line_total

                    validated_items.append({
                        "item_id":   str(db_item["id"]),
                        "sku":       db_item["sku"],
                        "name":      db_item["name"],
                        "quantity":  qty,
                        "unit_price": unit_price,
                        "line_total": line_total,
                    })
                    item_summaries.append(f"{db_item['name']} × {qty} @ ₹{unit_price:,.0f}")

                payload = {
                    "customer_id":   customer_id,
                    "customer_name": customer["name"],
                    "items":         validated_items,
                    "total_amount":  total_amount,
                }
                summary = (
                    f"Log sale to {customer['name']}: "
                    + ", ".join(item_summaries)
                    + f" — Total: ₹{total_amount:,.2f}"
                )

                cur.execute(
                    """
                    INSERT INTO pending_actions (action_type, payload, summary, proposed_by)
                    VALUES ('log_sale', %s, %s, 'crm_agent')
                    RETURNING id
                    """,
                    (json.dumps(payload), summary),
                )
                pending_id = str(cur.fetchone()["id"])

                append_audit_log(
                    cur,
                    actor="crm_agent",
                    action="proposed",
                    pending_action_id=pending_id,
                    detail={
                        "customer": customer["name"],
                        "total_amount": total_amount,
                        "items": validated_items,
                        "summary": summary,
                    },
                )

        return ok({
            "pending_action_id": pending_id,
            "summary":           summary,
            "total_amount":      total_amount,
            "customer_name":     customer["name"],
            "items":             validated_items,
        })

    except Exception as exc:
        logger.exception("log_sale failed")
        return err(str(exc))

"""
create_purchase_order — proposes a PO via pending_actions (requires confirmation).
"""
from __future__ import annotations
import json
import logging

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_uuid, require_positive_int, validate_items_list

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "create_purchase_order",
        "description": "Propose a purchase order from a vendor. Requires user confirmation before executing.",
        "parameters": {
            "type": "object",
            "properties": {
                "vendor_id": {
                    "type": "string",
                    "description": "UUID of the vendor entity.",
                },
                "items": {
                    "type": "array",
                    "description": "List of items to order: [{item_id, quantity, unit_cost}]",
                    "items": {
                        "type": "object",
                        "properties": {
                            "item_id":   {"type": "string"},
                            "quantity":  {"type": "integer"},
                            "unit_cost": {"type": "number"},
                        },
                        "required": ["item_id", "quantity"],
                    },
                },
            },
            "required": ["vendor_id", "items"],
        },
    },
}


def create_purchase_order(vendor_id: str, items: list[dict]) -> dict:
    """
    Validates: vendor exists (type='vendor'), each item exists, quantity > 0.
    Computes total_amount.
    Writes a pending_actions row (action_type='create_purchase_order').
    Returns: {"ok": True, "pending_action_id": str, "summary": str, "total_amount": float}
           | {"ok": False, "error": str}
    """
    try:
        require_uuid(vendor_id, "vendor_id")
        validate_items_list(items)

        with get_conn() as conn:
            with conn.cursor() as cur:
                # Validate vendor
                cur.execute(
                    "SELECT id, name FROM entities WHERE id = %s AND type = 'vendor'",
                    (vendor_id,),
                )
                vendor = cur.fetchone()
                if not vendor:
                    return err(f"Vendor not found: {vendor_id}")

                # Validate each item and fetch current cost
                validated_items = []
                total_amount = 0.0
                item_summaries = []
                for item in items:
                    cur.execute(
                        "SELECT id, sku, name, unit_cost FROM items WHERE id = %s",
                        (item["item_id"],),
                    )
                    db_item = cur.fetchone()
                    if not db_item:
                        return err(f"Item not found: {item['item_id']}")

                    unit_cost = float(item.get("unit_cost") or db_item["unit_cost"])
                    qty = item["quantity"]
                    line_total = unit_cost * qty
                    total_amount += line_total

                    validated_items.append({
                        "item_id":   str(db_item["id"]),
                        "sku":       db_item["sku"],
                        "name":      db_item["name"],
                        "quantity":  qty,
                        "unit_cost": unit_cost,
                        "line_total": line_total,
                    })
                    item_summaries.append(f"{db_item['name']} × {qty} @ ₹{unit_cost:,.0f}")

                # Write to pending_actions
                summary = (
                    f"Create Purchase Order from {vendor['name']}: "
                    + ", ".join(item_summaries)
                    + f" — Total: ₹{total_amount:,.2f}"
                )
                payload = {
                    "vendor_id":    vendor_id,
                    "vendor_name":  vendor["name"],
                    "items":        validated_items,
                    "total_amount": total_amount,
                }
                cur.execute(
                    """
                    INSERT INTO pending_actions (action_type, payload, summary, proposed_by)
                    VALUES ('create_purchase_order', %s, %s, 'procurement_agent')
                    RETURNING id
                    """,
                    (json.dumps(payload), summary),
                )
                pending_id = str(cur.fetchone()["id"])

                # Audit log
                cur.execute(
                    """
                    INSERT INTO audit_log (pending_action_id, actor, action, detail)
                    VALUES (%s, 'procurement_agent', 'proposed', %s)
                    """,
                    (pending_id, json.dumps({"summary": summary, "total_amount": total_amount})),
                )

        return ok({
            "pending_action_id": pending_id,
            "summary":           summary,
            "total_amount":      total_amount,
            "vendor_name":       vendor["name"],
            "items":             validated_items,
        })

    except Exception as exc:
        logger.exception("create_purchase_order failed")
        return err(str(exc))

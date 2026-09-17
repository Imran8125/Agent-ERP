"""
adjust_stock — proposes a stock adjustment via pending_actions (requires confirmation).
"""
from __future__ import annotations
import json
import logging

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_uuid, require_non_empty_str

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "adjust_stock",
        "description": "Propose a manual inventory adjustment (positive or negative delta). Requires confirmation.",
        "parameters": {
            "type": "object",
            "properties": {
                "item_id": {
                    "type": "string",
                    "description": "UUID of the item to adjust.",
                },
                "delta": {
                    "type": "integer",
                    "description": "Amount to add (positive) or subtract (negative) from quantity_on_hand.",
                },
                "reason": {
                    "type": "string",
                    "description": "Plain-language reason for the adjustment (e.g. 'physical count correction').",
                },
            },
            "required": ["item_id", "delta", "reason"],
        },
    },
}


def adjust_stock(item_id: str, delta: int, reason: str) -> dict:
    """
    Proposes items.quantity_on_hand += delta + ledger entry — via pending_actions.
    Returns: {"ok": True, "pending_action_id": str, "summary": str}
           | {"ok": False, "error": str}
    """
    try:
        require_uuid(item_id, "item_id")
        require_non_empty_str(reason, "reason")
        if not isinstance(delta, int) or delta == 0:
            return err("delta must be a non-zero integer")

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, sku, name, quantity_on_hand, unit_cost FROM items WHERE id = %s",
                    (item_id,),
                )
                item = cur.fetchone()
                if not item:
                    return err(f"Item not found: {item_id}")

                new_qty = item["quantity_on_hand"] + delta
                if new_qty < 0:
                    return err(
                        f"Adjustment would result in negative stock ({new_qty}) for {item['name']}. "
                        f"Current: {item['quantity_on_hand']}, delta: {delta}"
                    )

                payload = {
                    "item_id":   item_id,
                    "item_name": item["name"],
                    "sku":       item["sku"],
                    "delta":     delta,
                    "reason":    reason,
                    "old_qty":   item["quantity_on_hand"],
                    "new_qty":   new_qty,
                    "unit_cost": float(item["unit_cost"]),
                }
                direction = "+" if delta > 0 else ""
                summary = (
                    f"Adjust stock for {item['name']} (SKU: {item['sku']}): "
                    f"{item['quantity_on_hand']} → {new_qty} ({direction}{delta}) — Reason: {reason}"
                )

                cur.execute(
                    """
                    INSERT INTO pending_actions (action_type, payload, summary, proposed_by)
                    VALUES ('adjust_stock', %s, %s, 'inventory_agent')
                    RETURNING id
                    """,
                    (json.dumps(payload), summary),
                )
                pending_id = str(cur.fetchone()["id"])

                cur.execute(
                    """
                    INSERT INTO audit_log (pending_action_id, actor, action, detail)
                    VALUES (%s, 'inventory_agent', 'proposed', %s)
                    """,
                    (pending_id, json.dumps({"item": item["name"], "delta": delta, "reason": reason})),
                )

        return ok({"pending_action_id": pending_id, "summary": summary, "new_quantity": new_qty})

    except Exception as exc:
        logger.exception("adjust_stock failed")
        return err(str(exc))

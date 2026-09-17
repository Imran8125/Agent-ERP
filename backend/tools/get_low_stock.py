"""
get_low_stock — read-only tool to find items below reorder threshold.
"""
from __future__ import annotations
import logging

from db.models import get_conn
from common.errors import ok, err

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_low_stock",
        "description": "Get all inventory items that are at or below their reorder threshold. Returns items needing restocking.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
}


def get_low_stock() -> dict:
    """
    Read-only. Returns items where quantity_on_hand <= reorder_threshold.
    Returns: {"ok": True, "items": [...]} | {"ok": False, "error": str}
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, sku, name, description, unit_cost, unit_price,
                           quantity_on_hand, reorder_threshold, category
                    FROM items
                    WHERE quantity_on_hand <= reorder_threshold
                    ORDER BY
                        (quantity_on_hand::float / NULLIF(reorder_threshold, 0)) ASC NULLS LAST,
                        name
                    """
                )
                rows = cur.fetchall()

        items = []
        for r in rows:
            qoh = r["quantity_on_hand"]
            threshold = r["reorder_threshold"]
            shortage = threshold - qoh
            status = "out_of_stock" if qoh == 0 else "low_stock"

            items.append({
                "item_id":          r["id"],
                "sku":              r["sku"],
                "name":             r["name"],
                "description":      r["description"],
                "unit_cost":        float(r["unit_cost"]),
                "unit_price":       float(r["unit_price"]),
                "quantity_on_hand": qoh,
                "reorder_threshold": threshold,
                "shortage":         shortage,
                "category":         r["category"],
                "status":           status,
            })

        return ok({"items": items, "count": len(items)})

    except Exception as exc:
        logger.exception("get_low_stock failed")
        return err(str(exc))

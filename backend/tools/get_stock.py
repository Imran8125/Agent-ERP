"""
get_stock — read-only tool to query inventory items.
Fuzzy-matches item_name if provided, else returns all items.
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
        "name": "get_stock",
        "description": "Get current inventory stock levels. Fuzzy-match by item name if provided, else returns all items.",
        "parameters": {
            "type": "object",
            "properties": {
                "item_name": {
                    "type": "string",
                    "description": "Optional partial name to search for (case-insensitive).",
                }
            },
            "required": [],
        },
    },
}


def get_stock(item_name: Optional[str] = None) -> dict:
    """
    Read-only. Fuzzy-matches item_name if provided, else returns all items.
    Returns: {"ok": True, "items": [...]} | {"ok": False, "error": str}
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                if item_name:
                    cur.execute(
                        """
                        SELECT id, sku, name, description, unit_cost, unit_price,
                               quantity_on_hand, reorder_threshold, category
                        FROM items
                        WHERE name ILIKE %s OR sku ILIKE %s OR description ILIKE %s
                        ORDER BY name
                        """,
                        (f"%{item_name}%", f"%{item_name}%", f"%{item_name}%"),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, sku, name, description, unit_cost, unit_price,
                               quantity_on_hand, reorder_threshold, category
                        FROM items
                        ORDER BY
                            CASE WHEN quantity_on_hand <= reorder_threshold THEN 0 ELSE 1 END,
                            name
                        """
                    )
                rows = cur.fetchall()

        items = []
        for r in rows:
            qoh = r["quantity_on_hand"]
            threshold = r["reorder_threshold"]
            if qoh == 0:
                status = "out_of_stock"
            elif qoh <= threshold:
                status = "low_stock"
            else:
                status = "in_stock"

            items.append({
                "item_id":          r["id"],
                "sku":              r["sku"],
                "name":             r["name"],
                "description":      r["description"],
                "unit_cost":        float(r["unit_cost"]),
                "unit_price":       float(r["unit_price"]),
                "quantity_on_hand": qoh,
                "reorder_threshold": threshold,
                "category":         r["category"],
                "status":           status,
            })

        return ok({"items": items})

    except Exception as exc:
        logger.exception("get_stock failed")
        return err(str(exc))

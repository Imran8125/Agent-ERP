"""
get_stock — read-only tool to query inventory items.
Fuzzy-matches item_name if provided, else returns all items.
"""
from __future__ import annotations
import logging
import re
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
                    cleaned = item_name.strip()
                    # 1. Direct ILIKE
                    cur.execute(
                        """
                        SELECT id, sku, name, description, unit_cost, unit_price,
                               quantity_on_hand, reorder_threshold, category
                        FROM items
                        WHERE name ILIKE %s OR sku ILIKE %s OR description ILIKE %s
                        ORDER BY name
                        """,
                        (f"%{cleaned}%", f"%{cleaned}%", f"%{cleaned}%"),
                    )
                    rows = cur.fetchall()

                    # 2. Singularize if plural
                    if not rows and cleaned.lower().endswith("s") and len(cleaned) > 3:
                        singular = cleaned[:-1]
                        cur.execute(
                            """
                            SELECT id, sku, name, description, unit_cost, unit_price,
                                   quantity_on_hand, reorder_threshold, category
                            FROM items
                            WHERE name ILIKE %s OR sku ILIKE %s OR description ILIKE %s
                            ORDER BY name
                            """,
                            (f"%{singular}%", f"%{singular}%", f"%{singular}%"),
                        )
                        rows = cur.fetchall()

                    # 3. Word token search
                    if not rows:
                        clean_text = re.sub(r"[^\w\s]", " ", cleaned)
                        words = [w.rstrip("s") for w in clean_text.split() if len(w) > 2]
                        if words:
                            clauses = " AND ".join(["(name ILIKE %s OR description ILIKE %s)"] * len(words))
                            params = []
                            for w in words:
                                params.extend([f"%{w}%", f"%{w}%"])
                            cur.execute(
                                f"""
                                SELECT id, sku, name, description, unit_cost, unit_price,
                                       quantity_on_hand, reorder_threshold, category
                                FROM items
                                WHERE {clauses}
                                ORDER BY name
                                """,
                                tuple(params),
                            )
                            rows = cur.fetchall()

                            # 4. Fallback to any word
                            if not rows:
                                or_clauses = " OR ".join(["name ILIKE %s"] * len(words))
                                or_params = [f"%{w}%" for w in words]
                                cur.execute(
                                    f"""
                                    SELECT id, sku, name, description, unit_cost, unit_price,
                                           quantity_on_hand, reorder_threshold, category
                                    FROM items
                                    WHERE {or_clauses}
                                    ORDER BY name
                                    """,
                                    tuple(or_params),
                                )
                                rows = cur.fetchall()
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

"""
manual_entry — direct-save writes for manual form submissions.

Unlike agent tools (which propose via pending_actions), these execute
immediately (actor='user') and append to audit_log. Used by the manual
entry modals across Inventory / Customers / Vendors / Sales / POs.
"""
from __future__ import annotations

import logging
from typing import Optional

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_non_empty_str, require_uuid
from confirmation.crypto_ledger import append_audit_log

logger = logging.getLogger(__name__)


def _resolve_item(cur, ref: str):
    """Resolve an item by UUID, SKU, or name. Returns row or None."""
    ref = (ref or "").strip()
    if not ref:
        return None
    try:
        if len(ref) == 36:
            require_uuid(ref, "item_id")
            cur.execute("SELECT * FROM items WHERE id = %s", (ref,))
            row = cur.fetchone()
            if row:
                return row
    except Exception:
        pass
    cur.execute("SELECT * FROM items WHERE sku ILIKE %s LIMIT 1", (ref,))
    row = cur.fetchone()
    if row:
        return row
    cur.execute("SELECT * FROM items WHERE name ILIKE %s LIMIT 1", (f"%{ref}%",))
    return cur.fetchone()


def create_item(
    sku: str,
    name: str,
    unit_cost: float = 0,
    unit_price: float = 0,
    quantity_on_hand: int = 0,
    reorder_threshold: int = 0,
    category: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    try:
        require_non_empty_str(sku, "sku")
        require_non_empty_str(name, "name")
        sku, name = sku.strip(), name.strip()
        if unit_cost < 0 or unit_price < 0:
            return err("unit_cost and unit_price must be >= 0")
        if quantity_on_hand < 0 or reorder_threshold < 0:
            return err("quantity_on_hand and reorder_threshold must be >= 0")
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM items WHERE sku ILIKE %s", (sku,))
                if cur.fetchone():
                    return err(f"SKU already exists: {sku}")
                cur.execute(
                    """
                    INSERT INTO items (sku, name, unit_cost, unit_price,
                                       quantity_on_hand, reorder_threshold, category, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (sku, name, unit_cost, unit_price, quantity_on_hand,
                     reorder_threshold, category, description),
                )
                item_id = str(cur.fetchone()["id"])
                append_audit_log(cur, actor="user", action="manual_create_item",
                                 detail={"item_id": item_id, "sku": sku, "name": name})
        return ok({"item_id": item_id, "sku": sku, "name": name})
    except Exception as exc:
        logger.exception("create_item failed")
        return err(str(exc))


def update_item(item_id: str, fields: dict) -> dict:
    try:
        allowed = {"name", "unit_cost", "unit_price", "quantity_on_hand",
                   "reorder_threshold", "category", "description", "sku"}
        updates = {k: v for k, v in (fields or {}).items() if k in allowed}
        if not updates:
            return err("No valid fields to update")
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM items WHERE id = %s", (item_id,))
                if not cur.fetchone():
                    return err(f"Item not found: {item_id}")
                if "sku" in updates:
                    cur.execute(
                        "SELECT id FROM items WHERE sku ILIKE %s AND id != %s",
                        (updates["sku"], item_id),
                    )
                    if cur.fetchone():
                        return err(f"SKU already exists: {updates['sku']}")
                sets = ", ".join(f"{k} = %s" for k in updates)
                cur.execute(
                    f"UPDATE items SET {sets} WHERE id = %s RETURNING id",
                    (*updates.values(), item_id),
                )
                append_audit_log(cur, actor="user", action="manual_update_item",
                                 detail={"item_id": item_id, "fields": updates})
        return ok({"item_id": item_id, "updated": list(updates.keys())})
    except Exception as exc:
        logger.exception("update_item failed")
        return err(str(exc))


def adjust_stock_direct(item_id: str, delta: int, reason: str) -> dict:
    try:
        require_non_empty_str(reason, "reason")
        if not isinstance(delta, int) or delta == 0:
            return err("delta must be a non-zero integer")
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, unit_cost FROM items WHERE id = %s", (item_id,))
                row = cur.fetchone()
                if not row:
                    return err(f"Item not found: {item_id}")
                cur.execute(
                    "UPDATE items SET quantity_on_hand = quantity_on_hand + %s "
                    "WHERE id = %s RETURNING quantity_on_hand",
                    (delta, item_id),
                )
                new_qty = cur.fetchone()["quantity_on_hand"]
                if new_qty < 0:
                    raise ValueError(
                        f"Adjustment would drive stock negative ({new_qty}).")
                amount = abs(delta) * float(row["unit_cost"] or 0)
                if amount > 0:
                    if delta > 0:
                        cur.execute(
                            "INSERT INTO ledger (entry_type, account, amount, description) "
                            "VALUES ('debit', 'inventory', %s, %s)",
                            (amount, f"Manual stock add: {reason.strip()}"),
                        )
                        cur.execute(
                            "INSERT INTO ledger (entry_type, account, amount, description) "
                            "VALUES ('credit', 'cash', %s, %s)",
                            (amount, f"Manual stock add offset: {reason.strip()}"),
                        )
                    else:
                        cur.execute(
                            "INSERT INTO ledger (entry_type, account, amount, description) "
                            "VALUES ('debit', 'expense', %s, %s)",
                            (amount, f"Manual stock removal: {reason.strip()}"),
                        )
                        cur.execute(
                            "INSERT INTO ledger (entry_type, account, amount, description) "
                            "VALUES ('credit', 'inventory', %s, %s)",
                            (amount, f"Manual stock removal: {reason.strip()}"),
                        )
                append_audit_log(cur, actor="user", action="manual_adjust_stock",
                                 detail={"item_id": item_id, "delta": delta,
                                         "reason": reason.strip(), "new_quantity": new_qty})
        return ok({"item_id": item_id, "delta": delta, "new_quantity": new_qty})
    except Exception as exc:
        logger.exception("adjust_stock_direct failed")
        return err(str(exc))


def update_entity(entity_id: str, kind: str, fields: dict) -> dict:
    try:
        if kind not in ("customer", "vendor"):
            return err("kind must be 'customer' or 'vendor'")
        allowed = {"name", "email", "phone", "address"}
        updates = {k: (v.strip() if isinstance(v, str) else v)
                   for k, v in (fields or {}).items() if k in allowed}
        if "name" in updates and not updates["name"]:
            return err("name must be a non-empty string")
        if not updates:
            return err("No valid fields to update")
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM entities WHERE id = %s AND type = %s",
                    (entity_id, kind),
                )
                if not cur.fetchone():
                    return err(f"{kind.title()} not found: {entity_id}")
                sets = ", ".join(f"{k} = %s" for k in updates)
                cur.execute(f"UPDATE entities SET {sets} WHERE id = %s",
                            (*updates.values(), entity_id))
                append_audit_log(cur, actor="user", action=f"manual_update_{kind}",
                                 detail={"entity_id": entity_id, "fields": updates})
        return ok({"entity_id": entity_id, "updated": list(updates.keys())})
    except Exception as exc:
        logger.exception("update_entity failed")
        return err(str(exc))


def create_vendor(name: str, email: Optional[str] = None,
                  phone: Optional[str] = None, address: Optional[str] = None) -> dict:
    try:
        require_non_empty_str(name, "name")
        name = name.strip()
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM entities WHERE LOWER(name) = LOWER(%s) AND type = 'vendor'",
                    (name,),
                )
                existing = cur.fetchone()
                if existing:
                    return ok({"vendor_id": str(existing["id"]), "name": name,
                               "already_exists": True})
                cur.execute(
                    "INSERT INTO entities (type, name, email, phone, address) "
                    "VALUES ('vendor', %s, %s, %s, %s) RETURNING id",
                    (name, email, phone, address),
                )
                vendor_id = str(cur.fetchone()["id"])
                append_audit_log(cur, actor="user", action="manual_create_vendor",
                                 detail={"vendor_id": vendor_id, "name": name})
        return ok({"vendor_id": vendor_id, "name": name, "already_exists": False})
    except Exception as exc:
        logger.exception("create_vendor failed")
        return err(str(exc))


def create_sale_direct(customer_id: str, items: list[dict]) -> dict:
    try:
        require_uuid(customer_id, "customer_id")
        if not isinstance(items, list) or not items:
            return err("items must be a non-empty list")
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, name FROM entities WHERE id = %s AND type = 'customer'",
                    (customer_id,),
                )
                customer = cur.fetchone()
                if not customer:
                    return err(f"Customer not found: {customer_id}")
                validated, total = [], 0.0
                for it in items:
                    db_item = _resolve_item(cur, it.get("item_id") or "")
                    if not db_item:
                        return err(f"Item not found: {it.get('item_id')}")
                    qty = int(it.get("quantity", 0))
                    if qty <= 0:
                        return err(f"Quantity must be > 0 for {db_item['name']}")
                    if db_item["quantity_on_hand"] < qty:
                        return err(
                            f"Insufficient stock for {db_item['name']}: "
                            f"requested {qty}, available {db_item['quantity_on_hand']}")
                    price = float(it.get("unit_price") or db_item["unit_price"] or 0)
                    total += price * qty
                    validated.append({"item_id": str(db_item["id"]), "quantity": qty,
                                      "unit_price": price})
                cur.execute(
                    """INSERT INTO transactions (type, status, entity_id, total_amount,
                                                created_by, confirmed_at)
                       VALUES ('sale', 'confirmed', %s, %s, 'user', now()) RETURNING id""",
                    (customer_id, total),
                )
                tx_id = str(cur.fetchone()["id"])
                for v in validated:
                    cur.execute(
                        "INSERT INTO line_items (transaction_id, item_id, quantity, unit_price) "
                        "VALUES (%s, %s, %s, %s)",
                        (tx_id, v["item_id"], v["quantity"], v["unit_price"]),
                    )
                    cur.execute(
                        "UPDATE items SET quantity_on_hand = quantity_on_hand - %s WHERE id = %s",
                        (v["quantity"], v["item_id"]),
                    )
                cur.execute(
                    "INSERT INTO ledger (transaction_id, entry_type, account, amount, description) "
                    "VALUES (%s, 'debit', 'cash', %s, %s)",
                    (tx_id, total, f"Manual sale to {customer['name']}"),
                )
                cur.execute(
                    "INSERT INTO ledger (transaction_id, entry_type, account, amount, description) "
                    "VALUES (%s, 'credit', 'revenue', %s, %s)",
                    (tx_id, total, f"Manual sale revenue from {customer['name']}"),
                )
                append_audit_log(cur, actor="user", action="manual_log_sale",
                                 detail={"transaction_id": tx_id, "customer": customer["name"],
                                         "total_amount": total, "items": validated})
        return ok({"transaction_id": tx_id, "total_amount": total,
                   "customer_name": customer["name"]})
    except Exception as exc:
        logger.exception("create_sale_direct failed")
        return err(str(exc))


def create_po_direct(vendor_id: str, items: list[dict]) -> dict:
    try:
        require_uuid(vendor_id, "vendor_id")
        if not isinstance(items, list) or not items:
            return err("items must be a non-empty list")
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, name FROM entities WHERE id = %s AND type = 'vendor'",
                    (vendor_id,),
                )
                vendor = cur.fetchone()
                if not vendor:
                    return err(f"Vendor not found: {vendor_id}")
                validated, total = [], 0.0
                for it in items:
                    db_item = _resolve_item(cur, it.get("item_id") or "")
                    if not db_item:
                        return err(f"Item not found: {it.get('item_id')}")
                    qty = int(it.get("quantity", 0))
                    if qty <= 0:
                        return err(f"Quantity must be > 0 for {db_item['name']}")
                    cost = float(it.get("unit_cost") or db_item["unit_cost"] or 0)
                    total += cost * qty
                    validated.append({"item_id": str(db_item["id"]), "quantity": qty,
                                      "unit_cost": cost})
                cur.execute(
                    """INSERT INTO transactions (type, status, entity_id, total_amount, created_by)
                       VALUES ('purchase_order', 'ordered', %s, %s, 'user') RETURNING id""",
                    (vendor_id, total),
                )
                tx_id = str(cur.fetchone()["id"])
                for v in validated:
                    cur.execute(
                        "INSERT INTO line_items (transaction_id, item_id, quantity, unit_price) "
                        "VALUES (%s, %s, %s, %s)",
                        (tx_id, v["item_id"], v["quantity"], v["unit_cost"]),
                    )
                cur.execute(
                    "INSERT INTO ledger (transaction_id, entry_type, account, amount, description) "
                    "VALUES (%s, 'debit', 'inventory', %s, %s)",
                    (tx_id, total, f"Manual PO from {vendor['name']}"),
                )
                cur.execute(
                    "INSERT INTO ledger (transaction_id, entry_type, account, amount, description) "
                    "VALUES (%s, 'credit', 'cash', %s, %s)",
                    (tx_id, total, f"Manual PO payment to {vendor['name']}"),
                )
                append_audit_log(cur, actor="user", action="manual_create_po",
                                 detail={"transaction_id": tx_id, "vendor": vendor["name"],
                                         "total_amount": total, "items": validated})
        return ok({"transaction_id": tx_id, "total_amount": total,
                   "vendor_name": vendor["name"]})
    except Exception as exc:
        logger.exception("create_po_direct failed")
        return err(str(exc))

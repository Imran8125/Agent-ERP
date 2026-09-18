"""
create_purchase_order — proposes a PO via pending_actions (requires confirmation).
"""
from __future__ import annotations
import json
import logging
import re
from typing import Optional, Any

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_uuid, require_positive_int, validate_items_list
from common.settings_manager import check_spend_limits
from confirmation.crypto_ledger import append_audit_log

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "create_purchase_order",
        "description": "Propose a purchase order from a vendor. Requires user confirmation before executing. You can pass vendor_id or vendor_name (e.g. 'ABC Supplies', 'Valvetech').",
        "parameters": {
            "type": "object",
            "properties": {
                "vendor_id": {
                    "type": "string",
                    "description": "Optional UUID of the vendor entity.",
                },
                "vendor_name": {
                    "type": "string",
                    "description": "Optional name or keyword of the vendor (e.g. 'ABC Supplies', 'AeroClean', 'Valvetech', 'Polymer Seals'). Auto-resolved if vendor_id is omitted.",
                },
                "items": {
                    "type": "array",
                    "description": "List of items to order: [{item_id or sku, quantity, unit_cost}]",
                    "items": {
                        "type": "object",
                        "properties": {
                            "item_id":   {"type": "string", "description": "UUID or SKU of the item"},
                            "sku":       {"type": "string", "description": "SKU code of the item"},
                            "name":      {"type": "string", "description": "Name of the item"},
                            "quantity":  {"type": "integer"},
                            "unit_cost": {"type": "number", "description": "Optional unit cost in INR. If omitted, uses current catalog unit cost."},
                        },
                        "required": ["quantity"],
                    },
                },
            },
            "required": ["items"],
        },
    },
}


def create_purchase_order(
    *args,
    items: Optional[list[dict]] = None,
    vendor_id: Optional[str] = None,
    vendor_name: Optional[str] = None,
    **kwargs,
) -> dict:
    """
    Validates vendor (by ID, name, or auto-selected default) and items (by ID, SKU, or name).
    Computes total_amount and writes a pending_actions row.
    Accepts (vendor_id, items) or (items, vendor_id) positional or keyword arguments.
    """
    try:
        # Flexible positional parsing
        if args:
            if len(args) == 1:
                if isinstance(args[0], list) and items is None:
                    items = args[0]
                elif isinstance(args[0], str) and vendor_id is None:
                    vendor_id = args[0]
            elif len(args) >= 2:
                if isinstance(args[0], str) and isinstance(args[1], list):
                    vendor_id = args[0]
                    items = args[1]
                elif isinstance(args[0], list) and isinstance(args[1], str):
                    items = args[0]
                    vendor_id = args[1]
                else:
                    if items is None and isinstance(args[0], list):
                        items = args[0]
                    elif items is None and isinstance(args[1], list):
                        items = args[1]

        if items is None:
            items = []

        validate_items_list(items)

        with get_conn() as conn:
            with conn.cursor() as cur:
                vendor = None

                # 1. Resolve vendor by ID if provided and valid UUID
                if vendor_id:
                    try:
                        require_uuid(vendor_id, "vendor_id")
                        cur.execute(
                            "SELECT id, name FROM entities WHERE id = %s AND type = 'vendor'",
                            (vendor_id,),
                        )
                        vendor = cur.fetchone()
                    except Exception:
                        # If not a valid UUID, treat vendor_id as vendor_name search
                        if not vendor_name:
                            vendor_name = vendor_id

                # 2. Resolve vendor by name
                if not vendor and vendor_name:
                    cur.execute(
                        "SELECT id, name FROM entities WHERE type = 'vendor' AND name ILIKE %s ORDER BY name LIMIT 1",
                        (f"%{vendor_name}%",),
                    )
                    vendor = cur.fetchone()

                # 3. Default fallback to primary active vendor
                if not vendor:
                    cur.execute(
                        "SELECT id, name FROM entities WHERE type = 'vendor' ORDER BY name LIMIT 1"
                    )
                    vendor = cur.fetchone()

                if not vendor:
                    return err("No active vendor suppliers found in database.")

                # Validate each item and fetch current cost
                validated_items = []
                total_amount = 0.0
                item_summaries = []
                for item in items:
                    db_item = None
                    target_id = item.get("item_id")
                    target_sku = item.get("sku")
                    target_name = item.get("name")

                    # 1. Try UUID
                    if target_id:
                        try:
                            require_uuid(target_id, "item_id")
                            cur.execute("SELECT id, sku, name, unit_cost FROM items WHERE id = %s", (target_id,))
                            db_item = cur.fetchone()
                        except Exception:
                            if not target_sku:
                                target_sku = target_id

                    # 2. Try SKU exact or ILIKE
                    if not db_item:
                        for cand in [target_sku, target_id, target_name]:
                            if cand and isinstance(cand, str) and cand.strip():
                                cur.execute("SELECT id, sku, name, unit_cost FROM items WHERE sku ILIKE %s", (cand.strip(),))
                                db_item = cur.fetchone()
                                if db_item:
                                    break

                    # 3. Try Name exact, ILIKE, plural/singular, or word match
                    if not db_item:
                        for cand in [target_name, target_sku, target_id]:
                            if cand and isinstance(cand, str) and cand.strip():
                                c_clean = cand.strip()
                                # Direct ILIKE
                                cur.execute(
                                    "SELECT id, sku, name, unit_cost FROM items WHERE name ILIKE %s OR description ILIKE %s LIMIT 1",
                                    (f"%{c_clean}%", f"%{c_clean}%"),
                                )
                                db_item = cur.fetchone()
                                if db_item:
                                    break

                                # Try singularized
                                if c_clean.lower().endswith("s") and len(c_clean) > 3:
                                    singular = c_clean[:-1]
                                    cur.execute(
                                        "SELECT id, sku, name, unit_cost FROM items WHERE name ILIKE %s OR description ILIKE %s LIMIT 1",
                                        (f"%{singular}%", f"%{singular}%"),
                                    )
                                    db_item = cur.fetchone()
                                    if db_item:
                                        break

                                # Multi-word tokens
                                clean_text = re.sub(r"[^\w\s]", " ", c_clean)
                                words = [w.rstrip("s") for w in clean_text.split() if len(w) > 2]
                                if words:
                                    clauses = " AND ".join(["(name ILIKE %s OR description ILIKE %s)"] * len(words))
                                    params = []
                                    for w in words:
                                        params.extend([f"%{w}%", f"%{w}%"])
                                    cur.execute(f"SELECT id, sku, name, unit_cost FROM items WHERE {clauses} LIMIT 1", tuple(params))
                                    db_item = cur.fetchone()
                                    if db_item:
                                        break

                                    # Try individual keywords
                                    for w in words:
                                        cur.execute("SELECT id, sku, name, unit_cost FROM items WHERE name ILIKE %s LIMIT 1", (f"%{w}%",))
                                        db_item = cur.fetchone()
                                        if db_item:
                                            break
                                if db_item:
                                    break

                    if not db_item:
                        identifier = target_id or target_sku or target_name or "unknown"
                        return err(f"Inventory item not found: {identifier}")

                    unit_cost = float(item.get("unit_cost") or db_item["unit_cost"])
                    qty = int(item["quantity"])
                    line_total = unit_cost * qty
                    total_amount += line_total

                    validated_items.append({
                        "item_id":    str(db_item["id"]),
                        "sku":        db_item["sku"],
                        "name":       db_item["name"],
                        "quantity":   qty,
                        "unit_cost":  unit_cost,
                        "line_total": line_total,
                    })
                    item_summaries.append(f"{db_item['name']} ({db_item['sku']}) × {qty} @ ₹{unit_cost:,.0f}")

                # Autonomous spend guardrail check
                guardrail = check_spend_limits(total_amount)

                # Write to pending_actions
                summary = (
                    f"Create Purchase Order from {vendor['name']}: "
                    + ", ".join(item_summaries)
                    + f" — Total: ₹{total_amount:,.2f}"
                )
                if guardrail.get("warnings"):
                    summary += " [" + " | ".join(guardrail["warnings"]) + "]"

                payload = {
                    "vendor_id":          vendor_id,
                    "vendor_name":        vendor["name"],
                    "items":              validated_items,
                    "total_amount":       total_amount,
                    "guardrail":          guardrail,
                    "high_value_signoff": guardrail.get("exceeds_sign_off", False),
                    "daily_cap_breached": guardrail.get("exceeds_daily_cap", False),
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

                # Audit log with cryptographic SHA-256 chain
                append_audit_log(
                    cur,
                    actor="procurement_agent",
                    action="proposed",
                    pending_action_id=pending_id,
                    detail={
                        "summary": summary,
                        "total_amount": total_amount,
                        "vendor_name": vendor["name"],
                        "items": validated_items,
                        "guardrail": guardrail,
                    },
                )

        return ok({
            "pending_action_id":  pending_id,
            "summary":            summary,
            "total_amount":       total_amount,
            "vendor_name":        vendor["name"],
            "items":              validated_items,
            "guardrail":          guardrail,
            "high_value_signoff": guardrail.get("exceeds_sign_off", False),
            "daily_cap_breached": guardrail.get("exceeds_daily_cap", False),
        })

    except Exception as exc:
        logger.exception("create_purchase_order failed")
        return err(str(exc))

"""
Confirmation layer — confirm or reject pending_actions.
This is the only place where pending actions turn into real DB writes.
All operations are idempotent and wrapped in DB transactions.
"""
from __future__ import annotations
import json
import logging
from datetime import timezone, datetime
from typing import Optional

from db.models import get_conn
from common.errors import ok, err

logger = logging.getLogger(__name__)


def list_pending_actions() -> dict:
    """Return all pending_actions with status='pending', newest first."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, action_type, payload, summary, proposed_by, status, created_at
                    FROM pending_actions
                    WHERE status = 'pending'
                    ORDER BY created_at DESC
                    """
                )
                rows = cur.fetchall()

        return ok({
            "pending_actions": [
                {
                    "id":          str(r["id"]),
                    "action_type": r["action_type"],
                    "payload":     r["payload"],
                    "summary":     r["summary"],
                    "proposed_by": r["proposed_by"],
                    "status":      r["status"],
                    "created_at":  r["created_at"].isoformat() if r["created_at"] else None,
                }
                for r in rows
            ]
        })

    except Exception as exc:
        logger.exception("list_pending_actions failed")
        return err(str(exc))


def get_pending_action(pending_action_id: str) -> dict:
    """Get a single pending action by ID."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, action_type, payload, summary, proposed_by, status, created_at FROM pending_actions WHERE id = %s",
                    (pending_action_id,),
                )
                row = cur.fetchone()
                if not row:
                    return err(f"Pending action not found: {pending_action_id}")

        return ok({
            "id":          str(row["id"]),
            "action_type": row["action_type"],
            "payload":     row["payload"],
            "summary":     row["summary"],
            "proposed_by": row["proposed_by"],
            "status":      row["status"],
            "created_at":  row["created_at"].isoformat() if row["created_at"] else None,
        })

    except Exception as exc:
        logger.exception("get_pending_action failed")
        return err(str(exc))


def confirm_pending_action(pending_action_id: str) -> dict:
    """
    Idempotent. Executes the pending action inside a DB transaction.
    On success: sets status='confirmed', writes audit_log, executes the real write.
    Returns: {"ok": True, "result": {...}} | {"ok": False, "error": str}
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Lock the row
                cur.execute(
                    """
                    SELECT id, action_type, payload, summary, status
                    FROM pending_actions
                    WHERE id = %s FOR UPDATE
                    """,
                    (pending_action_id,),
                )
                row = cur.fetchone()
                if not row:
                    return err(f"Pending action not found: {pending_action_id}")

                if row["status"] == "confirmed":
                    return ok({"already_confirmed": True, "summary": row["summary"]})

                if row["status"] == "rejected":
                    return err("Cannot confirm a rejected action.")

                action_type = row["action_type"]
                payload = row["payload"]
                if isinstance(payload, str):
                    payload = json.loads(payload)

                # Execute the real write
                result = _dispatch(action_type, payload, cur)

                if not result.get("ok"):
                    return result

                # Mark confirmed
                cur.execute(
                    """
                    UPDATE pending_actions
                    SET status = 'confirmed', resolved_at = now()
                    WHERE id = %s
                    """,
                    (pending_action_id,),
                )

                # Audit log
                cur.execute(
                    """
                    INSERT INTO audit_log (pending_action_id, actor, action, detail)
                    VALUES (%s, 'user', 'confirmed', %s)
                    """,
                    (
                        pending_action_id,
                        json.dumps({"action_type": action_type, "result": str(result)[:500]}),
                    ),
                )

        return ok({"confirmed": True, "action_type": action_type, "result": result})

    except Exception as exc:
        logger.exception("confirm_pending_action failed for %s", pending_action_id)
        return err(str(exc))


def reject_pending_action(pending_action_id: str, reason: str = "") -> dict:
    """
    Idempotent. Sets status='rejected', writes audit_log.
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, status FROM pending_actions WHERE id = %s FOR UPDATE
                    """,
                    (pending_action_id,),
                )
                row = cur.fetchone()
                if not row:
                    return err(f"Pending action not found: {pending_action_id}")
                if row["status"] == "rejected":
                    return ok({"already_rejected": True})

                cur.execute(
                    """
                    UPDATE pending_actions
                    SET status = 'rejected', resolved_at = now()
                    WHERE id = %s
                    """,
                    (pending_action_id,),
                )
                cur.execute(
                    """
                    INSERT INTO audit_log (pending_action_id, actor, action, detail)
                    VALUES (%s, 'user', 'rejected', %s)
                    """,
                    (pending_action_id, json.dumps({"reason": reason})),
                )

        return ok({"rejected": True, "reason": reason})

    except Exception as exc:
        logger.exception("reject_pending_action failed for %s", pending_action_id)
        return err(str(exc))


# ---------------------------------------------------------------------------
# Internal dispatch — executed INSIDE the confirm transaction
# ---------------------------------------------------------------------------

def _dispatch(action_type: str, payload: dict, cur) -> dict:
    """
    Route confirmed action to the appropriate real write.
    All writes share the cursor from confirm_pending_action's transaction.
    """
    if action_type == "create_purchase_order":
        return _exec_create_purchase_order(payload, cur)
    elif action_type == "receive_stock":
        return _exec_receive_stock(payload, cur)
    elif action_type == "log_sale":
        return _exec_log_sale(payload, cur)
    elif action_type == "adjust_stock":
        return _exec_adjust_stock(payload, cur)
    else:
        return err(f"Unknown action_type: {action_type!r}")


def _exec_create_purchase_order(payload: dict, cur) -> dict:
    """Create the actual transaction + line_items rows."""
    vendor_id    = payload["vendor_id"]
    items        = payload["items"]
    total_amount = payload["total_amount"]

    cur.execute(
        """
        INSERT INTO transactions (type, status, entity_id, total_amount, created_by)
        VALUES ('purchase_order', 'ordered', %s, %s, 'procurement_agent')
        RETURNING id
        """,
        (vendor_id, total_amount),
    )
    tx_id = str(cur.fetchone()["id"])

    for item in items:
        cur.execute(
            """
            INSERT INTO line_items (transaction_id, item_id, quantity, unit_price)
            VALUES (%s, %s, %s, %s)
            """,
            (tx_id, item["item_id"], item["quantity"], item["unit_cost"]),
        )

    # Ledger: debit inventory, credit cash
    cur.execute(
        "INSERT INTO ledger (transaction_id, entry_type, account, amount, description) VALUES (%s, 'debit', 'inventory', %s, %s)",
        (tx_id, total_amount, f"PO from {payload.get('vendor_name', 'vendor')}"),
    )
    cur.execute(
        "INSERT INTO ledger (transaction_id, entry_type, account, amount, description) VALUES (%s, 'credit', 'cash', %s, %s)",
        (tx_id, total_amount, f"PO payment to {payload.get('vendor_name', 'vendor')}"),
    )

    return ok({"transaction_id": tx_id, "status": "ordered"})


def _exec_receive_stock(payload: dict, cur) -> dict:
    """Mark purchase order as received, increment inventory."""
    tx_id      = payload["transaction_id"]
    line_items = payload.get("line_items", [])

    cur.execute(
        "UPDATE transactions SET status = 'received', confirmed_at = now() WHERE id = %s",
        (tx_id,),
    )

    for li in line_items:
        cur.execute(
            "UPDATE items SET quantity_on_hand = quantity_on_hand + %s WHERE id = %s",
            (li["quantity"], li["item_id"]),
        )

    return ok({"transaction_id": tx_id, "status": "received"})


def _exec_log_sale(payload: dict, cur) -> dict:
    """Insert sale transaction + line_items, decrement stock, write ledger."""
    customer_id  = payload["customer_id"]
    items        = payload["items"]
    total_amount = payload["total_amount"]

    cur.execute(
        """
        INSERT INTO transactions (type, status, entity_id, total_amount, created_by, confirmed_at)
        VALUES ('sale', 'confirmed', %s, %s, 'crm_agent', now())
        RETURNING id
        """,
        (customer_id, total_amount),
    )
    tx_id = str(cur.fetchone()["id"])

    for item in items:
        cur.execute(
            "INSERT INTO line_items (transaction_id, item_id, quantity, unit_price) VALUES (%s, %s, %s, %s)",
            (tx_id, item["item_id"], item["quantity"], item["unit_price"]),
        )
        cur.execute(
            "UPDATE items SET quantity_on_hand = quantity_on_hand - %s WHERE id = %s",
            (item["quantity"], item["item_id"]),
        )

    # Ledger: debit cash, credit revenue
    cur.execute(
        "INSERT INTO ledger (transaction_id, entry_type, account, amount, description) VALUES (%s, 'debit', 'cash', %s, %s)",
        (tx_id, total_amount, f"Sale to {payload.get('customer_name', 'customer')}"),
    )
    cur.execute(
        "INSERT INTO ledger (transaction_id, entry_type, account, amount, description) VALUES (%s, 'credit', 'revenue', %s, %s)",
        (tx_id, total_amount, f"Revenue from {payload.get('customer_name', 'customer')}"),
    )

    return ok({"transaction_id": tx_id, "status": "confirmed", "total_amount": total_amount})


def _exec_adjust_stock(payload: dict, cur) -> dict:
    """Apply the stock delta and write a ledger entry for the adjustment."""
    item_id  = payload["item_id"]
    delta    = payload["delta"]
    reason   = payload["reason"]
    unit_cost = float(payload.get("unit_cost", 0))
    amount   = abs(delta) * unit_cost

    cur.execute(
        "UPDATE items SET quantity_on_hand = quantity_on_hand + %s WHERE id = %s RETURNING quantity_on_hand",
        (delta, item_id),
    )
    new_qty = cur.fetchone()["quantity_on_hand"]

    if amount > 0:
        entry_type = "debit" if delta > 0 else "credit"
        cur.execute(
            "INSERT INTO ledger (entry_type, account, amount, description) VALUES (%s, 'inventory', %s, %s)",
            (entry_type, amount, f"Stock adjustment: {reason}"),
        )

    return ok({"item_id": item_id, "new_quantity": new_qty, "delta": delta})

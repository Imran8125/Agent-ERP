"""
add_customer — auto-executes (low-risk, reversible). No confirmation needed.
"""
from __future__ import annotations
import json
import logging
from typing import Optional

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_non_empty_str
from confirmation.crypto_ledger import append_audit_log

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "add_customer",
        "description": "Add a new customer to the system. Low-risk — executes immediately without confirmation.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Full name of the customer or company.",
                },
                "email": {
                    "type": "string",
                    "description": "Customer email address (optional).",
                },
                "phone": {
                    "type": "string",
                    "description": "Customer phone number (optional).",
                },
                "address": {
                    "type": "string",
                    "description": "Customer address (optional).",
                },
            },
            "required": ["name"],
        },
    },
}


def add_customer(
    name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None,
) -> dict:
    """
    Low-risk write — auto-executes without confirmation.
    Inserts into entities (type='customer') and logs to audit_log.
    Returns: {"ok": True, "customer_id": str, "name": str}
           | {"ok": False, "error": str}
    """
    try:
        require_non_empty_str(name, "name")
        name = name.strip()

        with get_conn() as conn:
            with conn.cursor() as cur:
                # Check for duplicate
                cur.execute(
                    "SELECT id FROM entities WHERE LOWER(name) = LOWER(%s) AND type = 'customer'",
                    (name,),
                )
                existing = cur.fetchone()
                if existing:
                    return ok({
                        "customer_id": str(existing["id"]),
                        "name":        name,
                        "already_exists": True,
                        "message": f"Customer '{name}' already exists.",
                    })

                cur.execute(
                    """
                    INSERT INTO entities (type, name, email, phone, address)
                    VALUES ('customer', %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (name, email, phone, address),
                )
                customer_id = str(cur.fetchone()["id"])

                append_audit_log(
                    cur,
                    actor="crm_agent",
                    action="tool_call",
                    detail={"tool": "add_customer", "customer_id": customer_id, "name": name, "email": email, "phone": phone, "address": address},
                )

        return ok({
            "customer_id":    customer_id,
            "name":           name,
            "email":          email,
            "phone":          phone,
            "address":        address,
            "already_exists": False,
        })

    except Exception as exc:
        logger.exception("add_customer failed")
        return err(str(exc))

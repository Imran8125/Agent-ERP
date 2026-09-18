"""
get_customers — read-only tool to query active customers.
"""
from __future__ import annotations
import logging
from typing import Any, Optional

from db.models import get_conn
from common.errors import ok, err

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "get_customers",
        "description": "List all registered customers with their IDs, names, emails, and transaction volume. Use this to find customer IDs or lookup accounts.",
        "parameters": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Optional search term to filter customers by company or contact name (e.g. 'Apex', 'Zenith', 'Global').",
                }
            },
        },
    },
}


def get_customers(search: Optional[str] = None) -> dict[str, Any]:
    """Retrieve list of customers from entities table."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                if search and search.strip():
                    term = f"%{search.strip()}%"
                    cur.execute(
                        """
                        SELECT id, name, email, phone, address
                        FROM entities
                        WHERE type = 'customer' AND (name ILIKE %s OR email ILIKE %s OR address ILIKE %s)
                        ORDER BY name;
                        """,
                        (term, term, term)
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, name, email, phone, address
                        FROM entities
                        WHERE type = 'customer'
                        ORDER BY name;
                        """
                    )
                rows = cur.fetchall()

        customers = [
            {
                "customer_id": str(r["id"]),
                "id":          str(r["id"]),
                "name":        r["name"],
                "email":       r["email"],
                "phone":       r["phone"],
                "address":     r["address"],
            }
            for r in rows
        ]
        return ok({"customers": customers, "count": len(customers)})
    except Exception as exc:
        logger.exception("get_customers failed")
        return err(str(exc))

"""
get_vendors — read-only tool to retrieve active vendors.
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
        "name": "get_vendors",
        "description": "List all active suppliers and vendors with their IDs, names, emails, and categories. Use this to find vendor IDs for purchase orders.",
        "parameters": {
            "type": "object",
            "properties": {
                "search": {
                    "type": "string",
                    "description": "Optional search term to filter vendors by name or product specialty (e.g. 'filters', 'valves', 'seals', 'Acme', 'ABC').",
                }
            },
        },
    },
}


def get_vendors(search: Optional[str] = None) -> dict[str, Any]:
    """Retrieve list of vendors from entities table."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                if search:
                    cur.execute(
                        """
                        SELECT id, name, email, phone, address
                        FROM entities
                        WHERE type = 'vendor' AND (name ILIKE %s OR address ILIKE %s)
                        ORDER BY name;
                        """,
                        (f"%{search}%", f"%{search}%")
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, name, email, phone, address
                        FROM entities
                        WHERE type = 'vendor'
                        ORDER BY name;
                        """
                    )
                rows = cur.fetchall()

        vendors = [
            {
                "vendor_id": str(r["id"]),
                "id": str(r["id"]),
                "name": r["name"],
                "email": r["email"],
                "phone": r["phone"],
                "address": r["address"],
            }
            for r in rows
        ]
        return ok({"vendors": vendors, "count": len(vendors)})
    except Exception as exc:
        logger.exception("get_vendors failed")
        return err(str(exc))

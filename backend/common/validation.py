"""
Input validation helpers used across all tool functions.
"""
from __future__ import annotations

import re
import uuid


UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def is_valid_uuid(value: str) -> bool:
    """Return True if value is a valid UUID string."""
    if not isinstance(value, str):
        return False
    return bool(UUID_RE.match(value))


def require_uuid(value: str, field_name: str = "id") -> str:
    """Raise ValueError if value is not a valid UUID."""
    if not is_valid_uuid(value):
        raise ValueError(f"{field_name} must be a valid UUID, got: {value!r}")
    return value


def require_positive_int(value: int, field_name: str = "quantity") -> int:
    """Raise ValueError if value is not a positive integer."""
    if not isinstance(value, int) or value <= 0:
        raise ValueError(f"{field_name} must be a positive integer, got: {value!r}")
    return value


def require_non_empty_str(value: str, field_name: str = "value") -> str:
    """Raise ValueError if value is empty or not a string."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} must be a non-empty string")
    return value.strip()


def validate_items_list(items: list[dict]) -> list[dict]:
    """
    Validate a list of item dicts: [{item_id, quantity, unit_cost?}].
    Returns the list if valid, raises ValueError otherwise.
    """
    if not isinstance(items, list) or len(items) == 0:
        raise ValueError("items must be a non-empty list")
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"items[{i}] must be a dict")
        require_uuid(item.get("item_id", ""), f"items[{i}].item_id")
        require_positive_int(item.get("quantity", 0), f"items[{i}].quantity")
    return items

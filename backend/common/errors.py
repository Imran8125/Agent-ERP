"""
Common error patterns — every tool returns one of these shapes.
Never raise exceptions out of a tool function; catch and return error dict.
"""
from typing import Any


def ok(result: dict[str, Any]) -> dict[str, Any]:
    """Wrap a successful tool result."""
    return {"ok": True, **result}


def err(message: str) -> dict[str, Any]:
    """Return a normalized error result."""
    return {"ok": False, "error": message}


class ToolError(Exception):
    """Internal exception — caught at tool boundary and converted to err()."""
    pass


class NotFoundError(ToolError):
    pass


class ValidationError(ToolError):
    pass


class ConfirmationError(ToolError):
    pass

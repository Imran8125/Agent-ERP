"""
send_email — sends a notification email (Phase 1: stubbed/logged only).
NOTIFICATION ONLY — for already-confirmed actions. No confirmation needed.
"""
from __future__ import annotations
import json
import logging
from typing import Optional

from db.models import get_conn
from common.errors import ok, err
from common.validation import require_non_empty_str

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "send_email",
        "description": "Send a notification email about an already-confirmed action. Does not require confirmation.",
        "parameters": {
            "type": "object",
            "properties": {
                "to": {
                    "type": "string",
                    "description": "Recipient email address.",
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line.",
                },
                "body": {
                    "type": "string",
                    "description": "Plain-text email body.",
                },
                "related_transaction_id": {
                    "type": "string",
                    "description": "Optional UUID of the related transaction.",
                },
            },
            "required": ["to", "subject", "body"],
        },
    },
}


def send_email(
    to: str,
    subject: str,
    body: str,
    related_transaction_id: Optional[str] = None,
) -> dict:
    """
    Phase 1: Stubs the send and logs to audit_log (SES not available locally).
    Phase 2: Use SES via common.aws_clients.get_ses_client().
    Returns: {"ok": True, "message_id": str, "stubbed": bool}
    """
    try:
        require_non_empty_str(to, "to")
        require_non_empty_str(subject, "subject")
        require_non_empty_str(body, "body")

        import os
        is_phase2 = os.getenv("MODEL_BACKEND") == "bedrock"
        message_id = None

        if is_phase2:
            # Phase 2: real SES send
            try:
                from common.aws_clients import get_ses_client
                ses = get_ses_client()
                from_addr = os.getenv("SES_FROM_EMAIL", "noreply@agenterp.example.com")
                resp = ses.send_email(
                    Source=from_addr,
                    Destination={"ToAddresses": [to]},
                    Message={
                        "Subject": {"Data": subject},
                        "Body":    {"Text": {"Data": body}},
                    },
                )
                message_id = resp.get("MessageId", "unknown")
            except Exception as ses_exc:
                logger.warning("SES send failed, falling back to stub: %s", ses_exc)

        stubbed = message_id is None
        if stubbed:
            message_id = f"stub-{hash(to + subject) & 0xFFFFFF:06x}"
            logger.info("[STUB EMAIL] To: %s | Subject: %s", to, subject)

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit_log (actor, action, detail)
                    VALUES ('system', 'tool_call', %s)
                    """,
                    (json.dumps({
                        "tool":       "send_email",
                        "to":         to,
                        "subject":    subject,
                        "message_id": message_id,
                        "stubbed":    stubbed,
                        "related_transaction_id": related_transaction_id,
                    }),),
                )

        return ok({"message_id": message_id, "to": to, "stubbed": stubbed})

    except Exception as exc:
        logger.exception("send_email failed")
        return err(str(exc))

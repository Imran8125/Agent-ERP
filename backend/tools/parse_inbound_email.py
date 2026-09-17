"""
parse_inbound_email — Phase 2 stub (SES receive → S3 → Lambda → Bedrock parse → pending_actions).
Phase 1: not used.
"""
from __future__ import annotations
import logging
from typing import Optional

from common.errors import ok, err

logger = logging.getLogger(__name__)

TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "parse_inbound_email",
        "description": "Parse an inbound email (from S3 key) to extract ERP intent and write a pending_action. Phase 2 only.",
        "parameters": {
            "type": "object",
            "properties": {
                "raw_email_s3_key": {
                    "type": "string",
                    "description": "S3 key of the raw email file stored by SES.",
                }
            },
            "required": ["raw_email_s3_key"],
        },
    },
}


def parse_inbound_email(raw_email_s3_key: str) -> dict:
    """
    Phase 2 stub. In Phase 2:
    - Reads raw email from S3
    - Uses Bedrock to extract intent (e.g. "vendor confirmed shipment for PO #123")
    - Writes a pending_actions row with proposed_by='inbound_email'
    - Does NOT execute — goes through normal confirmation flow.
    """
    import os
    if os.getenv("MODEL_BACKEND") != "bedrock":
        return err("parse_inbound_email is a Phase 2 feature (requires MODEL_BACKEND=bedrock and SES/S3).")

    # Phase 2 implementation would go here
    return err("Phase 2 not yet implemented.")

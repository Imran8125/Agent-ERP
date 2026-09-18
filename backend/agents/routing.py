"""
Agent routing — intent classification and @tag extraction.
"""
from __future__ import annotations
import re
from typing import Optional

# Tag → agent mapping
TAG_TO_AGENT = {
    "procurement": "procurement",
    "inventory":   "inventory",
    "finance":     "finance",
    "crm":         "crm",
    "reporting":   "reporting",
    "reports":     "reporting",
    "audit":       "audit",
    "activity":    "audit",
}


def extract_tag(message: str) -> Optional[str]:
    """
    Extract @tag from message. Returns agent name or None.
    Example: "@inventory show low stock" → "inventory"
    """
    match = re.search(r"@(\w+)", message.lower())
    if match:
        tag = match.group(1)
        return TAG_TO_AGENT.get(tag)
    return None


def classify_intent(message: str) -> str:
    """
    Precision regex intent classifier with prioritized domain triggers.
    Prevents false substring collisions and respects visualization intent.
    """
    text = f" {message.lower()} "

    # 1. Cryptographic Audit / Merkle / WORM
    if re.search(r"\b(audit|merkle|tamper|cryptographic|worm|hash\s*chain|integrity)\b", text):
        return "audit"

    # 2. Charts & Reporting (takes precedence if charting/breakdown requested)
    if re.search(
        r"\b(charts?|graphs?|plots?|pie\s*charts?|bar\s*charts?|line\s*charts?|area\s*charts?|trends?|analytics|visualize|reports?|top\s+customers?)\b",
        text,
    ):
        return "reporting"

    # 3. Procurement / Purchasing / Restocking
    if re.search(
        r"\b(purchase\s*orders?|po\b|order|orders|buy\b|restock|suppliers?|vendors?|procure|replenish)\b",
        text,
    ):
        return "procurement"

    # 4. CRM / Customer relationships
    if re.search(
        r"\b(customers?|clients?|buyers?|transaction\s*history|purchase\s*volume|sales\s*history)\b",
        text,
    ):
        return "crm"

    # 5. Finance & Ledger
    if re.search(
        r"\b(cash|ledger|expenses?|revenue|profit|balance\s*sheet|accounting|financial|debits?|credits?)\b",
        text,
    ):
        return "finance"

    # 6. Inventory & Stock
    if re.search(
        r"\b(stocks?|inventory|warehouse|quantity|sku\b|on\s*hand|shortage)\b",
        text,
    ):
        return "inventory"

    return "master"


def route_message(message: str) -> str:
    """
    Route a user message to the appropriate agent name.
    Priority: @tag > keyword classification > master.
    """
    tag = extract_tag(message)
    if tag:
        return tag
    return classify_intent(message)

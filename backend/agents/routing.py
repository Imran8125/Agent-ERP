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
}

# Keywords → agent for intent classification
INTENT_KEYWORDS = {
    "procurement": ["purchase order", "po", "vendor", "order", "buy", "restock", "supplier", "receive stock", "shipment"],
    "inventory":   ["stock", "inventory", "item", "sku", "warehouse", "quantity", "units", "low stock", "reorder"],
    "finance":     ["cash", "ledger", "revenue", "expense", "payment", "financial", "balance", "accounting", "profit"],
    "crm":         ["customer", "client", "sale", "contact", "account", "history", "buyer"],
    "reporting":   ["report", "chart", "trend", "analytics", "summary", "dashboard", "top customers", "performance"],
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
    Keyword-based intent classification. Returns agent name.
    Defaults to 'master' if no clear match.
    """
    text = message.lower()
    scores = {agent: 0 for agent in INTENT_KEYWORDS}
    for agent, keywords in INTENT_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                scores[agent] += 1

    best = max(scores, key=scores.__getitem__)
    if scores[best] == 0:
        return "master"
    return best


def route_message(message: str) -> str:
    """
    Route a user message to the appropriate agent name.
    Priority: @tag > keyword classification > master.
    """
    tag = extract_tag(message)
    if tag:
        return tag
    return classify_intent(message)

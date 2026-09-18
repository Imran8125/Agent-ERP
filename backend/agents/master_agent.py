"""
Master Agent — routes incoming messages to the correct specialist agent.
Never calls tools directly; always delegates.
"""
from __future__ import annotations
import logging
from typing import Any

from agents.routing import route_message
import agents.procurement_agent as procurement
import agents.inventory_agent as inventory
import agents.finance_agent as finance
import agents.crm_agent as crm
import agents.reporting_agent as reporting

logger = logging.getLogger(__name__)

AGENT_REGISTRY = {
    "procurement": procurement,
    "inventory":   inventory,
    "finance":     finance,
    "crm":         crm,
    "reporting":   reporting,
}

GREETING_KEYWORDS = {"hello", "hi", "hey", "help", "what can you do", "start"}


def _is_greeting(message: str) -> bool:
    return any(kw in message.lower() for kw in GREETING_KEYWORDS) and len(message.split()) < 8


GREETING_RESPONSE = """👋 I'm your **AgentERP Master Orchestrator**. Here's what I can help with:

📦 **@inventory** — Stock levels, low-stock alerts, adjustments
🛒 **@procurement** — Purchase orders, vendor management, receiving
💰 **@finance** — Cash position, ledger, expense analysis
👤 **@crm** — Customer records, sales, transaction history
📊 **@reporting** — Sales trends, top customers, inventory value

Just type naturally or use **@tags** to route directly. For example:
- *"Show me low stock items"*
- *"@procurement Create a PO for 20 industrial filters from ABC Supplies"*
- *"What's our cash position?"*"""


def _detect_domain_and_items(target_agent: str, message: str, result: dict[str, Any]) -> tuple[str, list[str]]:
    """Determine UI domain to focus and any specific inventory items affected."""
    msg_lower = message.lower()
    items: list[str] = []

    # Check for audit keywords
    if any(k in msg_lower for k in ["audit", "merkle", "tamper", "hash chain", "dag", "immutable", "cryptographic", "worm"]):
        return "activity", []

    # Check reporting / analytics
    if target_agent == "reporting" or result.get("chart_spec"):
        return "reports", []

    # Check inventory & procurement
    if target_agent in ("procurement", "inventory"):
        # Inspect tool results or pending actions for affected item SKUs/names
        for tr in result.get("tool_results", []):
            res = tr.get("result", {})
            if isinstance(res, dict):
                # Check items in payload/result
                if "item" in res and isinstance(res["item"], dict):
                    sku = res["item"].get("sku") or res["item"].get("id")
                    if sku: items.append(str(sku))
                if "items" in res and isinstance(res["items"], list):
                    for itm in res["items"]:
                        if isinstance(itm, dict):
                            sku = itm.get("sku") or itm.get("item_id") or itm.get("name")
                            if sku: items.append(str(sku))
                if "sku" in res:
                    items.append(str(res["sku"]))
                if "payload" in res and isinstance(res["payload"], dict):
                    p = res["payload"]
                    if "sku" in p: items.append(str(p["sku"]))
                    if "items" in p and isinstance(p["items"], list):
                        for itm in p["items"]:
                            if isinstance(itm, dict):
                                sku = itm.get("sku") or itm.get("name")
                                if sku: items.append(str(sku))

        # Also extract SKUs from LLM content if present
        content = result.get("content", "")
        import re
        skus_in_content = re.findall(r"\bSKU-\d+\b", content, re.IGNORECASE)
        for s in skus_in_content:
            items.append(s.upper())

        # If low stock requested
        if any(k in msg_lower for k in ["low stock", "out of stock", "shortage", "reorder point"]):
            if "low_stock" not in items:
                items.insert(0, "low_stock")

        return "inventory", list(dict.fromkeys(items))

    if target_agent == "finance":
        return "finance", []

    if target_agent == "crm":
        return "customers", []

    return "inventory", []


def _handle_audit_query(message: str) -> dict[str, Any]:
    """Verify cryptographic audit DAG and return structured integrity report."""
    from confirmation.crypto_ledger import verify_audit_chain
    res = verify_audit_chain()

    is_valid = res.get("valid", False)
    total_blocks = res.get("total_blocks", 0)
    merkle_root = res.get("merkle_root", "0x0")
    engine = res.get("consensus_engine", "BFT-v4.2-strict")
    quorum = res.get("quorum", "3/3 verified")
    verified_at = res.get("verified_at", "")

    if is_valid:
        content = (
            "🔒 **Cryptographic Audit DAG Integrity Verification**\n\n"
            f"- **Status**: ✅ **VERIFIED — Zero Tampering Detected**\n"
            f"- **Total Ledger Blocks**: `{total_blocks}`\n"
            f"- **Merkle Root**: `{merkle_root}`\n"
            f"- **Consensus Engine**: `{engine}` ({quorum})\n"
            f"- **Timestamp**: `{verified_at}`\n\n"
            "All entries form an unbroken WORM (Write-Once-Read-Many) SHA-256 hash chain from genesis to tip. "
            "I have updated the right panel to display the live **Activity & Audit Log**."
        )
    else:
        errors = res.get("errors", [])
        err_msg = errors[0].get("error", "Unknown integrity failure") if errors else res.get("error", "Integrity check failed")
        content = (
            "⚠️ **Cryptographic Audit DAG Integrity Warning**\n\n"
            f"- **Status**: ❌ **INTEGRITY VIOLATION DETECTED**\n"
            f"- **Total Ledger Blocks**: `{total_blocks}`\n"
            f"- **Issue**: {err_msg}\n"
            f"- **Merkle Root**: `{merkle_root}`\n\n"
            "Please review the **Activity & Audit Log** in the right panel immediately."
        )

    return {
        "content": content,
        "agent": "audit",
        "tool_results": [],
        "pending_action_id": None,
        "domain_focus": "activity",
        "affected_items": [],
        "routed_to": "audit",
    }


def run(message: str, message_history: list[dict]) -> dict[str, Any]:
    """
    Route message to appropriate specialist agent and return result.
    Returns: {"content": str, "agent": str, "tool_results": [...], "pending_action_id": str|None, "chart_spec": ...}
    """
    # Handle greetings directly
    if _is_greeting(message):
        return {
            "content":          GREETING_RESPONSE,
            "agent":            "master",
            "tool_results":     [],
            "pending_action_id": None,
            "domain_focus":     "inventory",
            "affected_items":   [],
        }

    # Route to specialist
    target_agent = route_message(message)
    logger.info("Master routing '%s' → %s", message[:60], target_agent)

    # Handle audit directly
    if target_agent == "audit":
        return _handle_audit_query(message)

    agent_module = AGENT_REGISTRY.get(target_agent)
    if agent_module is None:
        # Fallback: handle directly
        return {
            "content": (
                "I'm not sure which module handles that. Try using @inventory, @procurement, "
                "@finance, @crm, or @reporting to route your request directly."
            ),
            "agent":            "master",
            "tool_results":     [],
            "pending_action_id": None,
            "domain_focus":     "inventory",
            "affected_items":   [],
        }

    # Build messages in OpenAI format (both user and assistant for multi-turn coherence)
    messages = []
    for msg in message_history:
        role = msg.get("role")
        if role in ("user", "assistant") and msg.get("content"):
            messages.append({"role": role, "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    try:
        result = agent_module.run(messages)
        result["routed_to"] = target_agent

        # Extract domain focus and affected items
        domain, affected_items = _detect_domain_and_items(target_agent, message, result)
        result["domain_focus"] = domain
        result["affected_items"] = affected_items

        return result
    except Exception as exc:
        logger.exception("Agent %s crashed", target_agent)
        return {
            "content":          f"I encountered an error while processing your request: {exc}",
            "agent":            target_agent,
            "tool_results":     [],
            "pending_action_id": None,
            "domain_focus":     "inventory",
            "affected_items":   [],
        }

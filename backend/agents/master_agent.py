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


def run(message: str, message_history: list[dict]) -> dict[str, Any]:
    """
    Route message to appropriate specialist agent and return result.
    Returns: {"content": str, "agent": str, "tool_results": [...], "pending_action_id": str|None}
    """
    # Handle greetings directly
    if _is_greeting(message):
        return {
            "content":          GREETING_RESPONSE,
            "agent":            "master",
            "tool_results":     [],
            "pending_action_id": None,
        }

    # Route to specialist
    target_agent = route_message(message)
    logger.info("Master routing '%s' → %s", message[:60], target_agent)

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
        }

    # Build messages in OpenAI format
    messages = [{"role": "user", "content": msg["content"]}
                for msg in message_history if msg.get("role") == "user"]
    messages.append({"role": "user", "content": message})

    try:
        result = agent_module.run(messages)
        result["routed_to"] = target_agent
        return result
    except Exception as exc:
        logger.exception("Agent %s crashed", target_agent)
        return {
            "content":          f"I encountered an error while processing your request: {exc}",
            "agent":            target_agent,
            "tool_results":     [],
            "pending_action_id": None,
        }

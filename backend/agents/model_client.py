"""
Model client abstraction — single interface for all agents.
Dispatches to LM Studio (Phase 1) or Bedrock (Phase 2) based on MODEL_BACKEND env var.
Provides full LM Studio v1 REST API support (models, load, unload, download, chat).
Never call LM Studio or Bedrock SDKs directly from agent code.
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))

logger = logging.getLogger(__name__)

MODEL_BACKEND = os.getenv("MODEL_BACKEND", "lmstudio")
LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234")
LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "google/gemma-4-e4b")
LM_API_TOKEN = os.getenv("LM_API_TOKEN") or os.getenv("LM_STUDIO_API_KEY")
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0")


def _get_lm_studio_root() -> str:
    """Normalize LM Studio base URL to root host e.g. http://localhost:1234."""
    url = LM_STUDIO_BASE_URL.rstrip("/")
    if url.endswith("/api/v1"):
        url = url[:-7]
    elif url.endswith("/v1"):
        url = url[:-3]
    return url


def _get_lm_studio_headers() -> dict[str, str]:
    """Return standard headers for LM Studio requests, including auth token if configured."""
    headers = {"Content-Type": "application/json"}
    if LM_API_TOKEN:
        headers["Authorization"] = f"Bearer {LM_API_TOKEN}"
    return headers


# ---------------------------------------------------------------------------
# LM Studio native v1 REST API helpers (LM Studio 0.4.0+)
# ---------------------------------------------------------------------------

def list_models() -> list[dict[str, Any]]:
    """
    GET /api/v1/models
    Get a list of available models on the system, including loaded instances.
    """
    root = _get_lm_studio_root()
    try:
        resp = httpx.get(
            f"{root}/api/v1/models",
            headers=_get_lm_studio_headers(),
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("models", [])
    except Exception as exc:
        logger.warning("Failed to list LM Studio models: %s", exc)
        return []


def get_loaded_models() -> list[dict[str, Any]]:
    """Return only models that currently have loaded instances in LM Studio."""
    all_models = list_models()
    return [m for m in all_models if m.get("loaded_instances")]


def get_active_model_id() -> str:
    """
    Get the best active model ID to use.
    Prefers configured LM_STUDIO_MODEL if it exists, or falls back to currently loaded model.
    """
    configured = LM_STUDIO_MODEL.strip()
    try:
        loaded = get_loaded_models()
        if loaded:
            loaded_ids = [inst.get("id") for m in loaded for inst in m.get("loaded_instances", []) if inst.get("id")]
            loaded_keys = [m.get("key") for m in loaded if m.get("key")]

            if configured in loaded_ids or configured in loaded_keys:
                return configured
            # Fall back to first loaded model
            if loaded_ids:
                return loaded_ids[0]
            if loaded_keys:
                return loaded_keys[0]
    except Exception:
        pass
    return configured or "google/gemma-4-e4b"


def load_model(model_key: str, config: Optional[dict] = None) -> dict[str, Any]:
    """
    POST /api/v1/models/load
    Load an LLM or embedding model into memory with optional custom configurations.
    """
    root = _get_lm_studio_root()
    payload: dict[str, Any] = {"model": model_key}
    if config:
        payload.update(config)

    resp = httpx.post(
        f"{root}/api/v1/models/load",
        headers=_get_lm_studio_headers(),
        json=payload,
        timeout=120.0,
    )
    resp.raise_for_status()
    return resp.json()


def unload_model(instance_id: str) -> dict[str, Any]:
    """
    POST /api/v1/models/unload
    Remove a loaded model instance from memory.
    """
    root = _get_lm_studio_root()
    payload = {"instance_id": instance_id}
    resp = httpx.post(
        f"{root}/api/v1/models/unload",
        headers=_get_lm_studio_headers(),
        json=payload,
        timeout=30.0,
    )
    resp.raise_for_status()
    return resp.json()


def download_model(model_key: str) -> dict[str, Any]:
    """
    POST /api/v1/models/download
    Initiate downloading a model.
    """
    root = _get_lm_studio_root()
    resp = httpx.post(
        f"{root}/api/v1/models/download",
        headers=_get_lm_studio_headers(),
        json={"model": model_key},
        timeout=30.0,
    )
    resp.raise_for_status()
    return resp.json()


def get_download_status() -> dict[str, Any]:
    """
    GET /api/v1/models/download/status
    Get the status of in-progress model downloads.
    """
    root = _get_lm_studio_root()
    resp = httpx.get(
        f"{root}/api/v1/models/download/status",
        headers=_get_lm_studio_headers(),
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()


def chat_v1(
    input_text: str | list[dict],
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    previous_response_id: Optional[str] = None,
    temperature: Optional[float] = None,
    max_output_tokens: Optional[int] = None,
    reasoning: Optional[str] = None,
    integrations: Optional[list[dict]] = None,
    store: bool = True,
) -> dict[str, Any]:
    """
    POST /api/v1/chat
    LM Studio 0.4.0 native stateful chat endpoint.
    Supports input text, system_prompt, stateful chat via previous_response_id,
    MCP integrations, and reasoning controls.
    """
    root = _get_lm_studio_root()
    resolved_model = model or get_active_model_id()
    payload: dict[str, Any] = {
        "model": resolved_model,
        "input": input_text,
        "store": store,
    }
    if system_prompt:
        payload["system_prompt"] = system_prompt
    if previous_response_id:
        payload["previous_response_id"] = previous_response_id
    if temperature is not None:
        payload["temperature"] = temperature
    if max_output_tokens is not None:
        payload["max_output_tokens"] = max_output_tokens
    if reasoning is not None:
        payload["reasoning"] = reasoning
    if integrations:
        payload["integrations"] = integrations

    resp = httpx.post(
        f"{root}/api/v1/chat",
        headers=_get_lm_studio_headers(),
        json=payload,
        timeout=120.0,
    )
    resp.raise_for_status()
    raw = resp.json()

    # Parse native output format
    content_parts = []
    tool_calls = []
    for item in raw.get("output", []):
        item_type = item.get("type")
        if item_type == "message":
            content_parts.append(item.get("content", ""))
        elif item_type == "tool_call":
            tool_calls.append({
                "name": item.get("tool", ""),
                "arguments": item.get("arguments", {}),
            })

    return {
        "content": "\n".join(content_parts) if content_parts else None,
        "tool_calls": tool_calls,
        "response_id": raw.get("response_id"),
        "model_instance_id": raw.get("model_instance_id"),
        "stats": raw.get("stats", {}),
        "raw": raw,
    }


# ---------------------------------------------------------------------------
# High-level chat_with_tools interface
# ---------------------------------------------------------------------------

def chat_with_tools(
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    agent_name: str = "agent",
) -> dict[str, Any]:
    """
    Send a chat completion request with tool definitions to the configured model backend.

    Returns a normalized dict:
    {
        "content":    str | None,
        "tool_calls": [{"name": str, "arguments": dict}]
    }

    Dispatches to LM Studio or Bedrock based on MODEL_BACKEND env var.
    Logs every raw model response for debugging.
    """
    try:
        if MODEL_BACKEND == "lmstudio":
            return _chat_lmstudio(system_prompt, messages, tools, agent_name)
        elif MODEL_BACKEND == "bedrock":
            return _chat_bedrock(system_prompt, messages, tools, agent_name)
        else:
            raise ValueError(f"Unknown MODEL_BACKEND: {MODEL_BACKEND!r}")
    except Exception as exc:
        logger.error("model_client error [%s]: %s", agent_name, exc)
        # Return a safe fallback so agents never crash on model errors
        return {"content": f"[Model error: {exc}]", "tool_calls": []}


# ---------------------------------------------------------------------------
# LM Studio backend
# ---------------------------------------------------------------------------

def _chat_lmstudio(
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    agent_name: str,
) -> dict[str, Any]:
    """
    LM Studio backend execution.
    For agent tool calling, LM Studio 0.4.0 supports custom tools via the OpenAI-compatible
    endpoint `/v1/chat/completions` (as specified in LM Studio's feature comparison matrix).
    """
    root = _get_lm_studio_root()
    active_model = get_active_model_id()

    payload: dict[str, Any] = {
        "model": active_model,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "temperature": 0.2,
        "max_tokens": 2048,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    t0 = time.time()
    resp = httpx.post(
        f"{root}/v1/chat/completions",
        headers=_get_lm_studio_headers(),
        json=payload,
        timeout=120.0,
    )
    resp.raise_for_status()
    raw = resp.json()
    latency_ms = int((time.time() - t0) * 1000)

    logger.debug("[%s] LM Studio raw response (%dms): %s", agent_name, latency_ms, json.dumps(raw)[:500])

    choice = raw["choices"][0]["message"]
    content = choice.get("content")
    tool_calls = []

    if choice.get("tool_calls"):
        for tc in choice["tool_calls"]:
            fn = tc.get("function", {})
            args = fn.get("arguments", "{}")
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            tool_calls.append({"name": fn.get("name", ""), "arguments": args})

    return {"content": content, "tool_calls": tool_calls}


# ---------------------------------------------------------------------------
# Bedrock backend (Phase 2)
# ---------------------------------------------------------------------------

def _chat_bedrock(
    system_prompt: str,
    messages: list[dict],
    tools: list[dict],
    agent_name: str,
) -> dict[str, Any]:
    """Bedrock converse API — mapped from OpenAI-style tool schemas."""
    from common.aws_clients import get_bedrock_runtime  # type: ignore

    client = get_bedrock_runtime()

    # Map OpenAI tool schemas to Bedrock's format
    bedrock_tools = []
    for t in tools:
        if t.get("type") == "function":
            fn = t["function"]
            bedrock_tools.append({
                "toolSpec": {
                    "name": fn["name"],
                    "description": fn.get("description", ""),
                    "inputSchema": {"json": fn.get("parameters", {})},
                }
            })

    # Map messages to Bedrock format
    bedrock_messages = []
    for m in messages:
        role = m["role"]
        if role == "user":
            bedrock_messages.append({"role": "user", "content": [{"text": m["content"]}]})
        elif role == "assistant":
            bedrock_messages.append({"role": "assistant", "content": [{"text": m.get("content", "")}]})

    kwargs: dict[str, Any] = {
        "modelId": BEDROCK_MODEL_ID,
        "system": [{"text": system_prompt}],
        "messages": bedrock_messages,
        "inferenceConfig": {"temperature": 0.2, "maxTokens": 2048},
    }
    if bedrock_tools:
        kwargs["toolConfig"] = {"tools": bedrock_tools}

    t0 = time.time()
    raw = client.converse(**kwargs)
    latency_ms = int((time.time() - t0) * 1000)
    logger.debug("[%s] Bedrock raw response (%dms): %s", agent_name, latency_ms, str(raw)[:500])

    content = None
    tool_calls = []

    output_message = raw.get("output", {}).get("message", {})
    for block in output_message.get("content", []):
        if "text" in block:
            content = block["text"]
        elif "toolUse" in block:
            tu = block["toolUse"]
            tool_calls.append({"name": tu["name"], "arguments": tu.get("input", {})})

    return {"content": content, "tool_calls": tool_calls}


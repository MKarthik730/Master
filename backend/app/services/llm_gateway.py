"""LLM Gateway — abstracts local (Ollama) and fallback (hosted API) LLM calls.

Strategy:
  1. Always try the small local model first (Ollama).
  2. If confidence/quality check fails, escalate to the larger model.
  3. Fallback model is configurable (OpenAI-compatible API by default).
"""

import json
import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class LLMResponse:
    """Structured response from an LLM call."""

    def __init__(
        self,
        content: str,
        model: str,
        confidence: float = 1.0,
        from_fallback: bool = False,
        token_count: int = 0,
    ):
        self.content = content
        self.model = model
        self.confidence = confidence
        self.from_fallback = from_fallback
        self.token_count = token_count

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "model": self.model,
            "confidence": self.confidence,
            "from_fallback": self.from_fallback,
            "token_count": self.token_count,
        }


async def _call_ollama(
    system_prompt: str,
    user_prompt: str,
    model: str = None,
    temperature: float = 0.1,
) -> Optional[LLMResponse]:
    """Call Ollama's chat API. Returns None if unavailable."""
    model = model or settings.ollama_model
    url = f"{settings.ollama_base_url}/api/chat"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "options": {"temperature": temperature},
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data.get("message", {}).get("content", "")
            return LLMResponse(
                content=content,
                model=model,
                token_count=data.get("eval_count", 0),
            )
    except (httpx.RequestError, httpx.HTTPStatusError, json.JSONDecodeError) as e:
        logger.warning("Ollama call failed: %s", e)
        return None


async def _call_fallback(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
) -> Optional[LLMResponse]:
    """Call the fallback (OpenAI-compatible) API."""
    if not settings.fallback_api_key:
        logger.warning("No fallback API key configured; skipping fallback")
        return None

    url = f"{settings.fallback_api_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.fallback_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.fallback_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return LLMResponse(
                content=content,
                model=settings.fallback_model,
                from_fallback=True,
                token_count=data.get("usage", {}).get("total_tokens", 0),
            )
    except (httpx.RequestError, httpx.HTTPStatusError, KeyError) as e:
        logger.error("Fallback LLM call failed: %s", e)
        return None


def _confidence_check(response: LLMResponse) -> bool:
    """Simple heuristic: if the response is very short or has markers of low quality,
    consider it low-confidence and trigger fallback."""
    content = response.content.strip()
    if len(content) < 20:
        return False
    # Check for generic non-answers
    low_confidence_phrases = [
        "i don't know",
        "i cannot answer",
        "i'm not sure",
        "i am not sure",
        "not enough information",
        "i don't have enough",
    ]
    content_lower = content.lower()
    if any(phrase in content_lower for phrase in low_confidence_phrases):
        return False
    return True


async def generate(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
    allow_fallback: bool = True,
    min_quality: bool = True,
) -> LLMResponse:
    """Generate a response using the LLM gateway.

    Tries the local model first; if quality check fails or local is
    unavailable, falls back to the larger model.
    """
    response = await _call_ollama(system_prompt, user_prompt, temperature=temperature)

    if response and (not min_quality or _confidence_check(response)):
        logger.info("Local LLM (%s) response OK (conf=%s)", response.model, response.confidence)
        return response

    if allow_fallback:
        logger.info("Local LLM response low-quality or unavailable; trying fallback")
        fallback = await _call_fallback(system_prompt, user_prompt, temperature=temperature)
        if fallback:
            return fallback

    # Return whatever we have (even if low quality)
    if response:
        return response

    # Everything failed
    return LLMResponse(
        content="I'm sorry, I couldn't generate a response right now. Please check that Ollama is running and/or your fallback API key is configured.",
        model="none",
        confidence=0.0,
    )


async def generate_with_citations(
    system_prompt: str,
    user_prompt: str,
    chunks: list[dict],
    temperature: float = 0.1,
) -> LLMResponse:
    """Generate a response with citations from source chunks.

    Formats the chunks as context and instructs the model to cite sources.
    """
    # Format context from chunks
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        source_info = f"[Source {i}]"
        if chunk.get("document_title"):
            source_info += f" from \"{chunk['document_title']}\""
        if chunk.get("section_heading"):
            source_info += f", section: {chunk['section_heading']}"
        if chunk.get("page_number"):
            source_info += f", page {chunk['page_number']}"
        context_parts.append(f"{source_info}\n{chunk['content']}")

    context = "\n\n".join(context_parts)

    full_system = (
        system_prompt
        + "\n\n"
        + "You are given context from textbook chunks below. Answer the user's question "
        + "based SOLELY on the provided context. If the context doesn't contain enough "
        + "information to answer, say so. Cite your sources using [Source N] notation "
        + "at the end of each relevant sentence."
    )

    full_user = (
        f"Context:\n{context}\n\n"
        f"Question: {user_prompt}\n\n"
        f"Answer with citations in the format [Source N]."
    )

    return await generate(full_system, full_user, temperature=temperature)

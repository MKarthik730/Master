"""Cross-encoder reranker service.

Uses a small cross-encoder model (ms-marco-MiniLM-L-6-v2) to rerank
retrieved chunks by relevance to the query. This significantly improves
the quality of chunks passed to the LLM.
"""

import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

_reranker = None


def _get_reranker():
    """Lazy-load the cross-encoder model."""
    global _reranker
    if _reranker is None:
        logger.info("Loading reranker model: %s", settings.reranker_model_name)
        from sentence_transformers import CrossEncoder
        _reranker = CrossEncoder(settings.reranker_model_name)
        logger.info("Reranker model loaded")
    return _reranker


def rerank(
    query: str,
    chunks: list[dict],
    top_k: int = None,
) -> list[dict]:
    """Rerank chunks by query relevance using cross-encoder.

    Each chunk dict must have at least a 'content' key.
    Returns the top-k reranked chunks with a 'rerank_score' added.
    """
    top_k = top_k or settings.top_k_rerank
    if not chunks:
        return []

    model = _get_reranker()

    # Prepare pairs
    pairs = [(query, c["content"]) for c in chunks]

    # Get relevance scores
    scores = model.predict(pairs)

    # Attach scores
    for i, chunk in enumerate(chunks):
        chunk["rerank_score"] = float(scores[i])

    # Sort by rerank score descending
    sorted_chunks = sorted(chunks, key=lambda x: x["rerank_score"], reverse=True)

    return sorted_chunks[:top_k]

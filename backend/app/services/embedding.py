"""Embedding service using sentence-transformers (bge-small-en-v1.5).

Singleton model loading — model is loaded once and reused.
Stores embeddings as JSON strings for SQLite compatibility.
"""

import json
import logging
from typing import Optional

import numpy as np
from app.config import settings

from app.database import cosine_similarity, json_to_embedding

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    """Lazy-load the sentence-transformers model."""
    global _model
    if _model is None:
        logger.info("Loading embedding model: %s", settings.embedding_model_name)
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(settings.embedding_model_name)
        logger.info("Embedding model loaded (dim=%d)", _model.get_sentence_embedding_dimension())
    return _model


def get_embedding_dimension() -> int:
    """Return the dimension of the loaded embedding model."""
    return _get_model().get_sentence_embedding_dimension()


def embed_text(text: str) -> list[float]:
    """Embed a single text string. Returns a list of floats."""
    model = _get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def embed_texts(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """Embed multiple texts in batch. Returns list of float lists."""
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, batch_size=batch_size)
    return [emb.tolist() for emb in embeddings]


def compute_similarity(query_emb: list[float], stored_emb_str: str) -> float:
    """Compute cosine similarity between query embedding and stored JSON embedding."""
    try:
        stored_emb = json_to_embedding(stored_emb_str)
        return cosine_similarity(query_emb, stored_emb)
    except (json.JSONDecodeError, TypeError, ValueError):
        return 0.0

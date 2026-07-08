"""Hybrid retriever — combines dense (pgvector) + sparse (Postgres FTS).

Scores are normalised and combined via configurable weights.
Technical terms (e.g. GNF, PDA) are handled by exact-match FTS.
"""

import logging
import math
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Chunk
from app.services.embedding import embed_text

logger = logging.getLogger(__name__)


async def dense_search(
    session: AsyncSession,
    query_text: str,
    domain: str,
    top_k: int = None,
) -> list[dict]:
    """Search chunks by pgvector cosine similarity.

    Uses raw SQL for the vector distance since pgvector's Vector type
    isn't directly supported in SQLAlchemy ORM.
    """
    top_k = top_k or settings.top_k_dense
    query_emb = embed_text(query_text)
    emb_str = "[" + ",".join(str(v) for v in query_emb) + "]"

    sql = text("""
        SELECT
            c.id,
            c.content,
            c.section_heading,
            c.page_number,
            c.chunk_index,
            c.document_id,
            d.title as document_title,
            d.domain,
            1 - (c.embedding <=> :embedding::vector) AS similarity
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.domain = :domain
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> :embedding::vector
        LIMIT :top_k
    """)

    result = await session.execute(sql, {
        "embedding": emb_str,
        "domain": domain,
        "top_k": top_k,
    })

    rows = result.mappings().all()
    return [dict(row) for row in rows]


async def sparse_search(
    session: AsyncSession,
    query_text: str,
    domain: str,
    top_k: int = None,
) -> list[dict]:
    """Search chunks by PostgreSQL full-text search (tsv + plainto_tsquery).

    Also adds a LIKE-based exact-match fallback for technical terms
    that the stemmer might mangle (e.g. 'PDA', 'GNF', 'CFG').
    """
    top_k = top_k or settings.top_k_sparse

    # Build tsquery from the query text
    sql = text("""
        SELECT
            c.id,
            c.content,
            c.section_heading,
            c.page_number,
            c.chunk_index,
            c.document_id,
            d.title as document_title,
            d.domain,
            ts_rank(
                to_tsvector('english', c.content),
                plainto_tsquery('english', :query_text)
            ) AS ts_rank
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.domain = :domain
          AND to_tsvector('english', c.content) @@ plainto_tsquery('english', :query_text)
        ORDER BY ts_rank DESC
        LIMIT :top_k
    """)

    result = await session.execute(sql, {
        "query_text": query_text,
        "domain": domain,
        "top_k": top_k,
    })
    rows = [dict(row) for row in result.mappings().all()]

    # Exact-match supplement: if query contains uppercase terms that look
    # like acronyms, do a LIKE search
    terms = query_text.split()
    exact_terms = [t for t in terms if t.isupper() and len(t) <= 10]
    if exact_terms:
        like_patterns = "|".join(exact_terms)
        like_sql = text("""
            SELECT
                c.id,
                c.content,
                c.section_heading,
                c.page_number,
                c.chunk_index,
                c.document_id,
                d.title as document_title,
                d.domain,
                1.0 AS ts_rank
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE d.domain = :domain
              AND c.content ~* :pattern
            ORDER BY c.chunk_index
            LIMIT :top_k
        """)
        like_result = await session.execute(like_sql, {
            "domain": domain,
            "pattern": like_patterns,
            "top_k": top_k,
        })
        existing_ids = {r["id"] for r in rows}
        for row in like_result.mappings().all():
            if row["id"] not in existing_ids:
                rows.append(dict(row))

    return rows


def _normalise_scores(
    results: list[dict],
    score_key: str,
    score_label: str = "score",
) -> list[dict]:
    """Min-max normalise scores to [0, 1] range."""
    if not results:
        return results

    scores = [r.get(score_key, 0) or 0 for r in results]
    min_s = min(scores)
    max_s = max(scores)
    range_s = max_s - min_s if max_s > min_s else 1.0

    for r in results:
        r[score_label] = (r.get(score_key, 0) - min_s) / range_s

    return results


async def hybrid_search(
    session: AsyncSession,
    query_text: str,
    domain: str,
    dense_weight: float = None,
    sparse_weight: float = None,
    top_k_dense: int = None,
    top_k_sparse: int = None,
    final_k: int = None,
) -> list[dict]:
    """Run dense + sparse search, normalise, fuse by weighted sum, return top-k."""
    dense_weight = dense_weight or settings.dense_weight
    sparse_weight = sparse_weight or settings.sparse_weight
    final_k = final_k or settings.final_k

    # Run both searches in parallel
    import asyncio
    dense_results, sparse_results = await asyncio.gather(
        dense_search(session, query_text, domain, top_k_dense),
        sparse_search(session, query_text, domain, top_k_sparse),
    )

    # Normalise scores
    dense_results = _normalise_scores(dense_results, "similarity", "dense_score")
    sparse_results = _normalise_scores(sparse_results, "ts_rank", "sparse_score")

    # Fuse by weighted sum
    fused: dict[str, dict] = {}
    for r in dense_results:
        r_id = str(r["id"])
        r["combined_score"] = r.get("dense_score", 0) * dense_weight
        fused[r_id] = r

    for r in sparse_results:
        r_id = str(r["id"])
        if r_id in fused:
            fused[r_id]["combined_score"] += r.get("sparse_score", 0) * sparse_weight
            fused[r_id]["sparse_score"] = r.get("sparse_score", 0)
        else:
            r["combined_score"] = r.get("sparse_score", 0) * sparse_weight
            r["dense_score"] = 0
            fused[r_id] = r

    # Sort by combined score descending
    sorted_results = sorted(
        fused.values(),
        key=lambda x: x.get("combined_score", 0),
        reverse=True,
    )

    return sorted_results[:final_k]

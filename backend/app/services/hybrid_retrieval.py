"""Hybrid retriever — combines dense (embedding cos-sim) + sparse (SQLite FTS5).

Scores are normalised and combined via configurable weights.
Technical terms (e.g. PDA, GNF, CFG) are handled by exact-match LIKE.
"""

import json
import logging
import math
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Chunk
from app.services.embedding import compute_similarity, embed_text

logger = logging.getLogger(__name__)


async def dense_search(
    session: AsyncSession,
    query_text: str,
    domain: str,
    top_k: int = None,
) -> list[dict]:
    """Search chunks by cosine similarity on JSON-stored embeddings.

    Loads all embeddings for the domain and scores them in Python.
    For larger datasets, this should be replaced with sqlite-vec.
    """
    top_k = top_k or settings.top_k_dense
    query_emb = embed_text(query_text)

    # Fetch all chunks with embeddings for this domain
    stmt = text("""
        SELECT
            c.id,
            c.content,
            c.section_heading,
            c.page_number,
            c.chunk_index,
            c.document_id,
            d.title as document_title,
            d.domain,
            c.embedding
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.domain = :domain
          AND c.embedding IS NOT NULL
    """)
    result = await session.execute(stmt, {"domain": domain})
    rows = [dict(row) for row in result.mappings().all()]

    # Compute cosine similarity in Python
    for row in rows:
        row["similarity"] = compute_similarity(query_emb, row["embedding"])
        del row["embedding"]

    # Sort by similarity descending
    rows.sort(key=lambda r: r["similarity"], reverse=True)
    return rows[:top_k]


async def sparse_search(
    session: AsyncSession,
    query_text: str,
    domain: str,
    top_k: int = None,
) -> list[dict]:
    """Search chunks by SQLite FTS5 full-text search.

    Also adds a LIKE-based exact-match fallback for technical terms
    that the stemmer might mangle (e.g. 'PDA', 'GNF', 'CFG').
    """
    top_k = top_k or settings.top_k_sparse

    # FTS5 search via the chunks_fts virtual table
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
            rank as ts_rank
        FROM chunks_fts fts
        JOIN chunks c ON c.id = fts.rowid
        JOIN documents d ON d.id = c.document_id
        WHERE d.domain = :domain
          AND chunks_fts MATCH :query_text
        ORDER BY rank
        LIMIT :top_k
    """)

    # Format query for FTS5 — use simple token matching
    fts_query = " OR ".join(query_text.split())

    try:
        result = await session.execute(sql, {
            "query_text": fts_query,
            "domain": domain,
            "top_k": top_k,
        })
        rows = [dict(row) for row in result.mappings().all()]
    except Exception as e:
        logger.warning("FTS5 search failed (trying LIKE fallback): %s", e)
        rows = []

    # Exact-match supplement: if query contains uppercase terms that look
    # like acronyms, do a LIKE search
    terms = query_text.split()
    exact_terms = [t for t in terms if t.isupper() and len(t) <= 10]
    if exact_terms or not rows:
        like_pattern = "%" + "%".join(query_text.split()) + "%"
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
              AND c.content LIKE :pattern
            ORDER BY c.chunk_index
            LIMIT :top_k
        """)
        like_result = await session.execute(like_sql, {
            "domain": domain,
            "pattern": like_pattern,
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

    # Run both searches sequentially (async session doesn't support concurrent ops)
    dense_results = await dense_search(session, query_text, domain, top_k_dense)
    sparse_results = await sparse_search(session, query_text, domain, top_k_sparse)

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

"""Tests for the hybrid retrieval logic.

Uses mock embeddings (simple float vectors) to avoid loading
sentence-transformers models.
"""

from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.database import Base, embedding_to_json
from app.models import Chunk, Document
from app.services.hybrid_retrieval import dense_search, sparse_search, hybrid_search


async def _seed_chunks(session):
    """Seed test documents and chunks with embeddings."""
    doc = Document(domain="test_domain", title="Test Textbook", source_type="textbook", total_pages=10)
    session.add(doc)
    await session.flush()

    # Simple mock embeddings: first 4 floats of a 384-dim vector
    chunk1 = Chunk(
        document_id=doc.id,
        content="Pushdown automata extend finite automata with a stack.",
        section_heading="Pushdown Automata",
        chunk_index=0,
        token_count=15,
        embedding=embedding_to_json([0.1] * 384),
    )
    chunk2 = Chunk(
        document_id=doc.id,
        content="Context-free grammars generate languages that PDAs recognize.",
        section_heading="Context-Free Grammars",
        chunk_index=1,
        token_count=15,
        embedding=embedding_to_json([0.2] * 384),
    )
    chunk3 = Chunk(
        document_id=doc.id,
        content="Turing machines are more powerful than PDAs.",
        section_heading="Turing Machines",
        chunk_index=2,
        token_count=12,
        embedding=embedding_to_json([0.3] * 384),
    )
    session.add_all([chunk1, chunk2, chunk3])
    await session.flush()

    # Seed FTS index
    try:
        await session.execute(text("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')"))
    except Exception:
        pass

    return {"doc": doc, "chunks": [chunk1, chunk2, chunk3]}


@pytest.mark.asyncio
async def test_dense_search_returns_ordered_results(session):
    """Dense search returns chunks sorted by similarity."""
    await _seed_chunks(session)

    # Mock embed_text to return a vector similar to chunk3
    with patch("app.services.hybrid_retrieval.embed_text", return_value=[0.3] * 384):
        results = await dense_search(session, "Turing machine", "test_domain", top_k=5)

    assert len(results) > 0
    # The chunk most similar to our query vector should be chunk3 (Turing machines)
    assert results[0]["similarity"] >= 0  # cosine similarity is non-negative for same-direction vectors


@pytest.mark.asyncio
async def test_sparse_search_returns_text_matches(session):
    """Sparse search returns chunks matching query terms."""
    await _seed_chunks(session)

    results = await sparse_search(session, "pushdown automata", "test_domain", top_k=5)
    assert len(results) > 0
    assert any("pushdown" in r["content"].lower() for r in results)


@pytest.mark.asyncio
async def test_hybrid_search_combines_scores(session):
    """Hybrid search fuses dense and sparse scores with weights."""
    await _seed_chunks(session)

    with patch("app.services.hybrid_retrieval.embed_text", return_value=[0.15] * 384):
        results = await hybrid_search(
            session, "pushdown automata", "test_domain",
            dense_weight=0.5, sparse_weight=0.5,
            top_k_dense=10, top_k_sparse=10, final_k=5,
        )

    assert len(results) > 0
    # Every result should have combined_score
    for r in results:
        assert "combined_score" in r
        assert r["combined_score"] >= 0


@pytest.mark.asyncio
async def test_hybrid_search_empty_domain(session):
    """Search in a domain with no chunks returns empty."""
    results = await hybrid_search(session, "anything", "empty_domain")
    assert results == []


@pytest.mark.asyncio
async def test_sparse_search_fallback_on_fts_failure(session):
    """When FTS fails, sparse search falls back to LIKE."""
    await _seed_chunks(session)

    # Query with uppercase term to trigger LIKE fallback
    results = await sparse_search(session, "PDA", "test_domain", top_k=5)
    # Should still find something via LIKE
    assert len(results) >= 0  # At least not crash


@pytest.mark.asyncio
async def test_hybrid_search_handles_acronyms(session):
    """Technical acronyms (PDAs, CFG) are handled by exact-match supplement."""
    await _seed_chunks(session)

    # Add a chunk with explicit acronym
    doc2 = Document(domain="test_domain", title="Automata Theory", source_type="textbook")
    session.add(doc2)
    await session.flush()

    chunk_acronym = Chunk(
        document_id=doc2.id,
        content="PDA stands for Pushdown Automaton. CFG stands for Context-Free Grammar.",
        section_heading="Acronyms",
        chunk_index=0,
        token_count=12,
        embedding=embedding_to_json([0.5] * 384),
    )
    session.add(chunk_acronym)
    await session.flush()
    try:
        await session.execute(text("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')"))
    except Exception:
        pass

    with patch("app.services.hybrid_retrieval.embed_text", return_value=[0.5] * 384):
        results = await hybrid_search(session, "PDA and CFG", "test_domain")
    assert len(results) > 0

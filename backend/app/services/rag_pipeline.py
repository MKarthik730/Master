"""Sequential RAG pipeline: retrieve → rerank → generate.

Each step is an async function called in sequence.
Includes confidence threshold check to prevent hallucination.
"""

import logging
from typing import Annotated, TypedDict

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.hybrid_retrieval import hybrid_search
from app.services.llm_gateway import LLMResponse, generate_with_citations
from app.services.reranker import rerank

logger = logging.getLogger(__name__)


# RAG State
class RAGState(TypedDict):
    query: str
    domain: str
    session: AsyncSession | None
    chunks: list[dict]
    reranked_chunks: list[dict]
    response: LLMResponse | None
    error: str | None


async def retrieve_node(state: RAGState) -> dict:
    """Retrieve relevant chunks via hybrid search."""
    try:
        chunks = await hybrid_search(
            session=state["session"],
            query_text=state["query"],
            domain=state["domain"],
        )
        return {"chunks": chunks, "error": None}
    except Exception as e:
        logger.error("Retrieval failed: %s", e)
        return {"chunks": [], "error": str(e)}


async def rerank_node(state: RAGState) -> dict:
    """Rerank retrieved chunks."""
    if not state.get("chunks"):
        return {"reranked_chunks": []}

    try:
        reranked = rerank(
            query=state["query"],
            chunks=state["chunks"],
        )
        return {"reranked_chunks": reranked}
    except Exception as e:
        logger.error("Reranking failed (using unranked): %s", e)
        return {"reranked_chunks": state["chunks"]}


async def generate_node(state: RAGState) -> dict:
    """Generate answer from reranked chunks."""
    if not state.get("reranked_chunks"):
        return {
            "response": LLMResponse(
                content="No relevant chunks found to answer your question. "
                       "Try ingesting some textbook content first.",
                model="none",
                confidence=0.0,
            )
        }

    # Check confidence threshold on the best chunk
    best_chunk = state["reranked_chunks"][0]
    rerank_score = best_chunk.get("rerank_score", 0) or best_chunk.get("combined_score", 0)

    if rerank_score < settings.confidence_threshold:
        logger.info(
            "Confidence threshold check: best chunk score %.4f < %.4f — not found",
            rerank_score, settings.confidence_threshold,
        )
        return {
            "response": LLMResponse(
                content="Not found in document — the uploaded materials don't contain enough relevant information to answer this question confidently.",
                model="none",
                confidence=0.0,
            )
        }

    try:
        system_prompt = (
            "You are a helpful study assistant. Answer questions based strictly on the "
            "provided textbook context. Always cite sources using [Source N] notation. "
            "If a topic has prerequisites the user hasn't studied yet, mention that."
        )
        response = await generate_with_citations(
            system_prompt=system_prompt,
            user_prompt=state["query"],
            chunks=state["reranked_chunks"],
        )
        return {"response": response}
    except Exception as e:
        logger.error("Generation failed: %s", e)
        return {
            "response": LLMResponse(
                content=f"An error occurred during generation: {e}",
                model="none",
                confidence=0.0,
            )
        }


async def run_rag_pipeline(
    query: str,
    domain: str,
    session: AsyncSession,
) -> dict:
    """Run the full RAG pipeline: retrieve → rerank → generate.

    Returns a dict with keys: answer, citations, chunks, response_meta.
    """
    state: RAGState = {
        "query": query,
        "domain": domain,
        "session": session,
        "chunks": [],
        "reranked_chunks": [],
        "response": None,
        "error": None,
    }

    # Retrieve
    state.update(await retrieve_node(state))
    if state.get("error"):
        return {
            "answer": f"Retrieval failed: {state['error']}",
            "citations": [],
            "chunks": [],
            "response_meta": {"confidence": 0.0, "from_fallback": False},
        }

    # Rerank
    state.update(await rerank_node(state))

    # Generate
    state.update(await generate_node(state))

    # Build output
    response = state["response"]
    chunks = state["reranked_chunks"]

    # Extract citations
    citations = []
    for chunk in chunks[:5]:
        citation = {
            "source": chunk.get("document_title", "Unknown"),
            "section": chunk.get("section_heading", ""),
            "page": chunk.get("page_number"),
            "content_preview": chunk["content"][:200] + "...",
        }
        citations.append(citation)

    return {
        "answer": response.content if response else "No response generated.",
        "citations": citations,
        "chunks": chunks[:5],
        "response_meta": response.to_dict() if response else {"confidence": 0.0},
    }

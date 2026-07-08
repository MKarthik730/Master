"""Query endpoint — ask questions, get RAG-grounded answers with citations."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.rag_pipeline import run_rag_pipeline

router = APIRouter(prefix="/query", tags=["query"])


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    domain: str = Field(default="theory_of_computation", max_length=255)


class Citation(BaseModel):
    source: str
    section: str = ""
    page: int | None = None
    content_preview: str = ""


class ResponseMeta(BaseModel):
    confidence: float = 0.0
    from_fallback: bool = False
    model: str = ""


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation] = []
    response_meta: ResponseMeta = ResponseMeta()


@router.post("", response_model=QueryResponse)
async def query_rag(
    request: QueryRequest,
    session: AsyncSession = Depends(get_db),
):
    """Ask a question and get a RAG-grounded answer with citations."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty")

    result = await run_rag_pipeline(
        query=request.query,
        domain=request.domain,
        session=session,
    )

    return QueryResponse(
        answer=result.get("answer", ""),
        citations=[
            Citation(**c) for c in result.get("citations", [])
        ],
        response_meta=ResponseMeta(**result.get("response_meta", {})),
    )

"""Ingest endpoint — upload and process textbook PDFs into the RAG corpus."""

import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Document, Chunk
from app.services.chunking import chunk_text
from app.services.embedding import embed_texts, embedding_to_pgvector
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["ingest"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class IngestResponse(BaseModel):
    document_id: str
    title: str
    chunks_created: int
    domain: str


async def extract_text_from_pdf(file_path: str) -> tuple[str, int]:
    """Extract text from a digital-text PDF using pypdf."""
    from pypdf import PdfReader

    reader = PdfReader(file_path)
    text_parts = []
    page_count = len(reader.pages)
    for page in reader.pages:
        text = page.extract_text()
        if text and text.strip():
            text_parts.append(text.strip())

    return "\n\n".join(text_parts), page_count


@router.post("", response_model=IngestResponse)
async def ingest_pdf(
    file: UploadFile = File(...),
    domain: str = settings.default_domain,
    session: AsyncSession = Depends(get_db),
):
    """Upload and ingest a textbook PDF into the RAG corpus.

    Text is extracted, chunked, embedded, and stored synchronously.
    Returns the document ID and number of chunks created.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Save uploaded file
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Extract text
    text, page_count = await extract_text_from_pdf(file_path)
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the PDF")

    # Chunk
    chunks_data = chunk_text(text)
    if not chunks_data:
        raise HTTPException(status_code=400, detail="No chunks could be created from the PDF text")

    # Create document record
    document = Document(
        domain=domain,
        title=file.filename,
        source_type="textbook",
        file_path=file_path,
        total_pages=page_count,
    )
    session.add(document)
    await session.flush()

    # Embed all chunks
    texts_to_embed = [c["content"] for c in chunks_data]
    embeddings = embed_texts(texts_to_embed)

    # Store chunks
    for i, (chunk_info, embedding) in enumerate(zip(chunks_data, embeddings)):
        chunk = Chunk(
            document_id=document.id,
            content=chunk_info["content"],
            section_heading=chunk_info.get("section_heading", ""),
            chunk_index=i,
            token_count=chunk_info.get("token_count", 0),
            embedding=embedding_to_pgvector(embedding),
        )
        session.add(chunk)

    await session.flush()
    logger.info("Ingested %d chunks from %s", len(chunks_data), file.filename)

    return IngestResponse(
        document_id=str(document.id),
        title=file.filename,
        chunks_created=len(chunks_data),
        domain=domain,
    )

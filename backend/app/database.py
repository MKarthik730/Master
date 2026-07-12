"""Async SQLAlchemy engine and session factory with SQLite backend.

Uses aiosqlite for async SQLite support. Vector storage uses sqlite-vec
extension for embedding similarity search.
"""

import json
import logging
import math
from typing import Optional

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    connect_args={"check_same_thread": False},
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency: yield an async DB session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Create all tables (call on startup).

    Also loads sqlite-vec extension for vector operations.
    """
    async with engine.begin() as conn:
        # Enable WAL mode for better concurrent read performance
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        # Enable foreign keys
        await conn.execute(text("PRAGMA foreign_keys=ON"))

        # Try to load sqlite-vec extension if available
        try:
            await conn.execute(text("SELECT load_extension('vec0')"))
            logger.info("sqlite-vec extension loaded")
        except Exception:
            logger.info("sqlite-vec extension not available; using Python-side vector search")
            # We'll fall back to Python-side cosine similarity

        # Create the FTS5 virtual table for full-text search
        await conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                content,
                section_heading,
                content='chunks',
                content_rowid='id'
            )
        """))

        await conn.run_sync(Base.metadata.create_all)


async def rebuild_fts_index(session: AsyncSession | None = None):
    """Rebuild the FTS index after bulk inserts.

    If a session is provided, uses that session's connection (same transaction).
    Otherwise opens a new connection.
    """
    if session is not None:
        await session.execute(text("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')"))
    else:
        async with engine.begin() as conn:
            await conn.execute(text("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')"))


# === Vector search helpers (Python-side, SQLite-compatible) ===

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(ai * bi for ai, bi in zip(a, b))
    norm_a = math.sqrt(sum(ai * ai for ai in a))
    norm_b = math.sqrt(sum(bi * bi for bi in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def embedding_to_json(embedding: list[float]) -> str:
    """Serialize embedding vector to JSON string for SQLite storage."""
    return json.dumps([round(v, 8) for v in embedding])


def json_to_embedding(emb_str: str) -> list[float]:
    """Deserialize embedding vector from JSON string."""
    return json.loads(emb_str)

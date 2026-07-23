"""Test fixtures for the Master backend test suite.

Provides a test database (SQLite in-memory) with seeded syllabus data,
plus mock embedding/reranker patches to avoid loading heavy models.
"""

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base, get_db
from app.main import app

# Override settings for testing
settings.database_url = "sqlite+aiosqlite://"
settings.db_echo = False
settings.confidence_threshold = 0.0  # disable threshold for tests
settings.top_k_dense = 10
settings.top_k_sparse = 10
settings.top_k_rerank = 5
settings.final_k = 5
settings.dense_weight = 0.5
settings.sparse_weight = 0.5


@pytest_asyncio.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    """Create a fresh in-memory SQLite engine for the test session."""
    eng = create_async_engine(
        "sqlite+aiosqlite://",
        echo=False,
        connect_args={"check_same_thread": False},
    )
    async with eng.begin() as conn:
        # Enable extensions
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA foreign_keys=ON"))
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        # Create FTS5 table
        await conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                content,
                section_heading,
                content='chunks',
                content_rowid='id'
            )
        """))
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Get a transactional test session with auto-rollback."""
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as s:
        # Start a transaction that will be rolled back after the test
        async with s.begin():
            yield s
        # Rollback any remaining transaction
        await s.rollback()


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI test client with dependency override for the test session."""

    async def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()

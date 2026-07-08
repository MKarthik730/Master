"""FastAPI application entry point.

Registers all routers and runs startup seed logic.
"""

import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, init_db, async_session_factory
from app.seed_data.toc import seed_all

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup DB init + seeding, shutdown engine."""
    # Startup
    logger.info("Starting Study Gap-Detection App")
    await init_db()
    logger.info("Database tables created")

    # Seed initial data
    async with async_session_factory() as session:
        await seed_all(session)
        await session.commit()

    logger.info("Seed data loaded")
    yield

    # Shutdown
    await engine.dispose()
    logger.info("Database engine disposed")


app = FastAPI(
    title="Study Gap-Detection API",
    description="RAG-powered study gap detection with knowledge graphs",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow PWA frontend on any origin in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from app.routers import query, progress, gaps, graph, ingest
app.include_router(query.router)
app.include_router(progress.router)
app.include_router(gaps.router)
app.include_router(graph.router)
app.include_router(ingest.router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "domain": settings.default_domain}

"""FastAPI application entry point for the Master placement-prep tool.

Started either directly (uvicorn app.main:app) or via the `master` CLI command.
On startup, seeds the syllabus from topics_full.json if the database is empty.
"""

import json
import logging
import os

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, init_db, async_session_factory
from app.services.graph_service import seed_from_syllabus

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup DB init + seeding, shutdown engine."""
    # Startup
    logger.info("Starting Master — CSE Placement Prep Tool")
    await init_db()
    logger.info("Database tables created")

    # Seed syllabus from topics_full.json (if not already seeded)
    async with async_session_factory() as session:
        try:
            await seed_from_syllabus(session)
            await session.commit()
            logger.info("Syllabus seeded successfully")
        except Exception as e:
            await session.rollback()
            logger.exception("Syllabus seeding skipped: %s", e)

    yield

    # Shutdown
    await engine.dispose()
    logger.info("Database engine disposed")


app = FastAPI(
    title="Master — CSE Placement Prep",
    description="Syllabus tracker + knowledge graph + PDF RAG for placement preparation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Register API routers ===
from app.routers import query, progress, gaps, graph, ingest
app.include_router(query.router)
app.include_router(progress.router)
app.include_router(gaps.router)
app.include_router(graph.router)
app.include_router(ingest.router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "domain": settings.default_domain,
        "model": settings.ollama_model,
    }


@app.get("/api/roadmap")
async def get_roadmap():
    """Get the roadmap name from the syllabus JSON."""
    try:
        with open(settings.syllabus_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {"roadmap": data.get("roadmap", "CSE Placement Prep")}
    except Exception:
        return {"roadmap": "CSE Placement Prep"}


# === Serve frontend static files ===
frontend_dist = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "frontend", "dist"
)
if os.path.exists(frontend_dist):
    # Mount hashed assets at /assets (efficient StaticFiles — no route conflicts)
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # Catch-all route for SPA — registered LAST so API routes take precedence.
    # Uses a regular route (not a Mount), so it doesn't shadow other routes.
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve static files from the built frontend, with SPA fallback."""
        # Security: prevent path traversal outside frontend_dist
        safe_path = os.path.normpath(os.path.join(frontend_dist, full_path or "index.html"))
        if not safe_path.startswith(os.path.normpath(frontend_dist)):
            return FileResponse(os.path.join(frontend_dist, "index.html"))
        if os.path.isfile(safe_path):
            return FileResponse(safe_path)
        # SPA fallback: return index.html for client-side routing
        return FileResponse(os.path.join(frontend_dist, "index.html"))

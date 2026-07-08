"""Seed data initializer for the Theory of Computation domain.

Run on app startup to populate the graph (if empty) and load sample
hardcoded progress state.
"""

import logging
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Progress, Topic
from app.services.graph_service import (
    create_edge,
    create_topic,
    get_topic_by_name,
    seed_toc_graph,
)

logger = logging.getLogger(__name__)

DOMAIN = "theory_of_computation"

# Topics the user "has studied" (hardcoded seed)
SAMPLE_COVERED_TOPICS = [
    "fundamentals",
    "finite_automata_dfa",
    "finite_automata_nfa",
    "regular_expressions",
    "regular_languages",
    "context_free_grammars",
    "cfg_simplification",
]


async def seed_all(session: AsyncSession):
    """Seed the database with initial data if empty.

    Safe to call on every startup (idempotent).
    """
    # Check if data already exists
    stmt = select(Topic).where(Topic.domain == DOMAIN).limit(1)
    result = await session.execute(stmt)
    if result.scalar_one_or_none():
        logger.info("Topics already seeded for %s; skipping", DOMAIN)
    else:
        await seed_toc_graph(session)
        logger.info("Seeded TOC graph")

    # Check if progress already exists
    progress_stmt = (
        select(Progress)
        .where(Progress.domain == DOMAIN)
        .limit(1)
    )
    progress_result = await session.execute(progress_stmt)
    if progress_result.scalar_one_or_none():
        logger.info("Progress already seeded for %s; skipping", DOMAIN)
    else:
        await seed_sample_progress(session)
        logger.info("Seeded sample progress")


async def seed_sample_progress(session: AsyncSession):
    """Seed hardcoded progress state for testing gap detection."""
    domain = DOMAIN

    # Map topic names from sample to their IDs
    for topic_name in SAMPLE_COVERED_TOPICS:
        topic = await get_topic_by_name(session, domain, topic_name)
        if topic:
            progress = Progress(
                domain=domain,
                topic_id=topic.id,
                status="covered",
                source="hardcoded_seed",
            )
            session.add(progress)

    # Also mark some topics as "in_progress" to show mixed state
    in_progress_names = ["normal_forms_cnf_gnf"]
    for topic_name in in_progress_names:
        topic = await get_topic_by_name(session, domain, topic_name)
        if topic:
            progress = Progress(
                domain=domain,
                topic_id=topic.id,
                status="in_progress",
                source="hardcoded_seed",
            )
            session.add(progress)

    await session.flush()

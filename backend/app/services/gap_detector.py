"""Gap detection service.

Pure logic: given progress and prerequisite graph, find topics that
should have been studied but haven't been (gaps). Generates RAG-grounded
explanations for why each gap matters.

Algorithm:
  1. Build the dependency graph from syllabus JSON.
  2. For each topic not marked 'covered', check if its prerequisites
     are all covered.
  3. If not all covered, flag each uncovered prerequisite as a gap.
  4. Topics with uncovered prerequisites are 'locked'.
  5. Topics whose prerequisites are all covered but not yet started are 'available'.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Progress, Topic, Subtopic
from app.services.graph_service import (
    get_prerequisites,
    get_dependents,
    get_subtopics,
)

logger = logging.getLogger(__name__)


async def detect_gaps(
    session: AsyncSession,
    domain: str,
) -> list[dict]:
    """Detect study gaps for a domain.

    Returns list of gap dicts with:
      topic, prerequisite_for, covered_by, explanation, suggested_order
    """
    # Fetch all topics for this domain
    topics_stmt = select(Topic).where(Topic.domain == domain).order_by(Topic.sort_order)
    topics_result = await session.execute(topics_stmt)
    all_topics = topics_result.scalars().all()

    # Get all progress records
    progress_stmt = select(Progress).where(Progress.domain == domain)
    progress_result = await session.execute(progress_stmt)
    all_progress = progress_result.scalars().all()

    # Build covered set (topic-level + fully-covered subtopic-rolled-up)
    covered_topic_ids = set()
    in_progress_topic_ids = set()

    for p in all_progress:
        if p.subtopic_id is None and p.status == "covered":
            covered_topic_ids.add(p.topic_id)

    # Roll up subtopic progress to topic level
    for t in all_topics:
        if t.id in covered_topic_ids:
            continue
        subtopics = await get_subtopics(session, t.id)
        if subtopics:
            sub_progress = {}
            for p in all_progress:
                if p.subtopic_id is not None:
                    stmt = select(Subtopic).where(Subtopic.id == p.subtopic_id)
                    sub_result = await session.execute(stmt)
                    sub = sub_result.scalar_one_or_none()
                    if sub and sub.topic_id == t.id:
                        sub_progress[p.subtopic_id] = p.status

            if len(sub_progress) == len(subtopics) and all(s == "covered" for s in sub_progress.values()):
                covered_topic_ids.add(t.id)
            elif any(s in ("covered", "in_progress") for s in sub_progress.values()):
                in_progress_topic_ids.add(t.id)

    # Detect gaps: find topics whose prerequisites aren't covered
    gaps = []
    seen_gap_topic_ids: set[int] = set()

    for topic in all_topics:
        if topic.id in covered_topic_ids:
            continue

        prereqs = await get_prerequisites(session, topic.id)
        for prereq in prereqs:
            if prereq.id not in covered_topic_ids:
                if prereq.id not in seen_gap_topic_ids:
                    seen_gap_topic_ids.add(prereq.id)
                    dependents = await get_dependents(session, prereq.id)
                    prereq_for = [t.title for t in dependents if t.id != prereq.id]

                    gaps.append({
                        "topic": {
                            "id": str(prereq.id),
                            "name": prereq.title,
                            "description": prereq.description or "",
                            "module": prereq.module,
                        },
                        "prerequisite_for": prereq_for,
                        "covered_by": [],
                        "explanation": (
                            f"{prereq.title} is a prerequisite for {', '.join(prereq_for) if prereq_for else 'other topics'}. "
                            f"Complete {prereq.title} before moving on."
                        ),
                        "suggested_order": len(gaps) + 1,
                    })
                break  # Don't add multiple gaps for the same topic

    # Sort gaps by suggested order
    gaps.sort(key=lambda g: g["suggested_order"])

    return gaps

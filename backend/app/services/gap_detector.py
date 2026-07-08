"""Gap detection service.

Pure logic: given progress and prerequisite graph, find topics that
should have been studied but haven't been (gaps). Generates RAG-grounded
explanations for why each gap matters.

Important: The gap-detection logic is independent of how progress gets
populated (hardcoded seed vs. user upload). It operates on the progress
table and the graph only.
"""

import logging
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Progress, Topic, TopicEdge
from app.services.hybrid_retrieval import hybrid_search
from app.services.rag_pipeline import run_rag_pipeline

logger = logging.getLogger(__name__)


async def detect_gaps(
    session: AsyncSession,
    domain: str,
) -> list[dict]:
    """Detect study gaps for a domain.

    Algorithm:
      1. Fetch all 'covered' topics from progress.
      2. For each covered topic, find its prerequisites.
      3. If a prerequisite is NOT covered, flag it as a gap.
      4. Generate RAG-grounded explanation for each gap.
    """
    # Fetch covered topics
    covered_stmt = select(Progress).where(
        Progress.domain == domain,
        Progress.status == "covered",
    )
    covered_result = await session.execute(covered_stmt)
    covered_progress = covered_result.scalars().all()
    covered_topic_ids = {p.topic_id for p in covered_progress}

    if not covered_topic_ids:
        return []

    # Fetch all topics for this domain
    topics_stmt = select(Topic).where(Topic.domain == domain)
    topics_result = await session.execute(topics_stmt)
    all_topics = {
        str(t.id): {"id": str(t.id), "name": t.name, "description": t.description or ""}
        for t in topics_result.scalars().all()
    }

    # Fetch all prerequisite edges for this domain's topics
    edges_stmt = (
        select(TopicEdge)
        .join(Topic, TopicEdge.topic_id == Topic.id)
        .where(Topic.domain == domain)
        .options(
            selectinload(TopicEdge.topic),
            selectinload(TopicEdge.prerequisite),
        )
    )
    edges_result = await session.execute(edges_stmt)
    edges = edges_result.scalars().all()

    # Build: for each covered topic, check if its prerequisites are covered
    gaps = []
    seen_gap_topics: set[str] = set()

    for edge in edges:
        topic_id = str(edge.topic_id)
        prereq_id = str(edge.prerequisite_id)

        if topic_id in covered_topic_ids and prereq_id not in covered_topic_ids:
            if prereq_id not in seen_gap_topics:
                seen_gap_topics.add(prereq_id)

                prereq_topic = all_topics.get(
                    prereq_id, {"id": prereq_id, "name": "Unknown", "description": ""}
                )
                topic_name = all_topics.get(topic_id, {}).get("name", "Unknown")

                gap = {
                    "topic": prereq_topic,
                    "prerequisite_for": [topic_name],
                    "covered_by": [],
                    "explanation": "",
                    "suggested_order": len(gaps) + 1,
                }
                gaps.append(gap)
            else:
                for g in gaps:
                    if g["topic"]["id"] == prereq_id:
                        topic_name = all_topics.get(topic_id, {}).get("name", "Unknown")
                        if topic_name not in g["prerequisite_for"]:
                            g["prerequisite_for"].append(topic_name)
                        break

    # Generate RAG-grounded explanations for each gap
    for gap in gaps:
        gap["explanation"] = await _generate_gap_explanation(
            session, domain, gap["topic"], gap["prerequisite_for"]
        )

    return gaps


async def _generate_gap_explanation(
    session: AsyncSession,
    domain: str,
    topic: dict,
    prerequisite_for: list[str],
) -> str:
    """Generate a RAG-grounded explanation of why this gap matters."""
    topic_name = topic.get("name", "")
    topic_desc = topic.get("description", "")

    query = (
        f"What is {topic_name} and why is it important as a foundation for "
        f"understanding {', '.join(prerequisite_for)}? "
        f"Context: {topic_desc}"
    )

    try:
        result = await run_rag_pipeline(query, domain, session)
        answer = result.get("answer", "")
        if len(answer) > 1000:
            answer = answer[:1000] + "..."
        return answer
    except Exception as e:
        logger.error("Failed to generate gap explanation: %s", e)
        return f"{topic_name} is a prerequisite for {', '.join(prerequisite_for)}. Study this topic before proceeding."

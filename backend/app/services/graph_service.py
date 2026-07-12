"""Knowledge graph service — topic and edge CRUD for the syllabus graph.

Built to work with any JSON syllabus matching the schema:
  { "roadmap": str, "modules": [{ "module": str, "topics": [...] }] }
"""

import json
import logging
import os
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import Topic, TopicEdge, Subtopic, Progress

logger = logging.getLogger(__name__)


async def get_topic_tree(
    session: AsyncSession,
    domain: str,
) -> list[dict]:
    """Get the full topic tree with status, subtopics, and prerequisites.

    This is the main data structure for the syllabus tracker UI.
    """
    topics_stmt = select(Topic).where(Topic.domain == domain).order_by(Topic.sort_order)
    topics_result = await session.execute(topics_stmt)
    all_topics = topics_result.scalars().all()

    result = []
    for topic in all_topics:
        status = "available"
        prereqs = await get_prerequisites(session, topic.id)

        # Check if all prerequisites are covered
        prereqs_met = True
        for prereq in prereqs:
            p_stmt = select(Progress).where(
                Progress.topic_id == prereq.id,
                Progress.domain == domain,
                Progress.subtopic_id.is_(None),
            )
            p_result = await session.execute(p_stmt)
            p_progress = p_result.scalar_one_or_none()
            if not p_progress or p_progress.status != "covered":
                # Check subtopic rollup
                prereq_subtopics = await get_subtopics(session, prereq.id)
                if prereq_subtopics:
                    sub_stmt = select(Progress).where(
                        Progress.topic_id == prereq.id,
                        Progress.domain == domain,
                        Progress.subtopic_id.isnot(None),
                    )
                    sub_result = await session.execute(sub_stmt)
                    sub_progress = sub_result.scalars().all()
                    covered_subs = sum(1 for sp in sub_progress if sp.status == "covered")
                    if covered_subs < len(prereq_subtopics):
                        prereqs_met = False
                        break
                else:
                    prereqs_met = False
                    break

        if not prereqs_met:
            status = "locked"
        else:
            # Check own progress
            progress_stmt = select(Progress).where(
                Progress.topic_id == topic.id,
                Progress.domain == domain,
            )
            progress_result = await session.execute(progress_stmt)
            all_progress = progress_result.scalars().all()

            has_progress = any(
                p.status in ("covered", "in_progress")
                for p in all_progress
            )

            if not has_progress:
                status = "available"
            else:
                subtopics = await get_subtopics(session, topic.id)
                if subtopics:
                    sub_progress_map = {}
                    for p in all_progress:
                        if p.subtopic_id is not None:
                            sub_progress_map[p.subtopic_id] = p.status

                    covered_subs = sum(1 for s in subtopics if sub_progress_map.get(s.id) == "covered")
                    if covered_subs == len(subtopics):
                        status = "covered"
                    elif covered_subs > 0:
                        status = "in_progress"
                    else:
                        status = "available"
                else:
                    topic_progress = next(
                        (p for p in all_progress if p.subtopic_id is None),
                        None
                    )
                    if topic_progress:
                        status = topic_progress.status

        subtopics = await get_subtopics(session, topic.id)
        subtopic_list = []
        for subtopic in subtopics:
            sub_progress = None
            sub_prog_result = await session.execute(
                select(Progress).where(
                    Progress.subtopic_id == subtopic.id,
                    Progress.domain == domain,
                )
            )
            sp = sub_prog_result.scalar_one_or_none()
            if sp:
                sub_progress = sp.status

            subtopic_list.append({
                "id": subtopic.id,
                "title": subtopic.title,
                "status": sub_progress or ("available" if status != "locked" else "locked"),
            })

        result.append({
            "id": topic.id,
            "topic_id": topic.topic_id,
            "title": topic.title,
            "module": topic.module,
            "status": status,
            "subtopics": subtopic_list,
            "prerequisites": [p.topic_id for p in prereqs],
            "prerequisite_titles": [p.title for p in prereqs],
        })

    return result


async def get_full_graph(
    session: AsyncSession,
    domain: str,
) -> dict:
    """Fetch all topics and edges for a domain.

    Returns a dict suitable for graph visualization:
      { "nodes": [...], "edges": [...] }
    Each node includes module info for color-coding.
    """
    stmt = (
        select(Topic)
        .where(Topic.domain == domain)
        .options(selectinload(Topic.incoming_edges), selectinload(Topic.outgoing_edges))
        .order_by(Topic.sort_order)
    )
    result = await session.execute(stmt)
    topics = result.scalars().all()

    nodes = []
    for topic in topics:
        # Count how many other topics depend on this one (for node sizing)
        dep_count = len(topic.incoming_edges)  # incoming edges = others' prerequisites point to this

        nodes.append({
            "id": str(topic.id),
            "name": topic.title,
            "topic_id": topic.topic_id,
            "module": topic.module,
            "description": topic.description or "",
            "source": topic.source,
            "confidence": topic.confidence,
            "dependency_count": dep_count,
        })

    edges = []
    for topic in topics:
        for edge in topic.incoming_edges:
            edges.append({
                "id": str(edge.id),
                "from": str(edge.prerequisite_id),
                "to": str(edge.topic_id),
                "confidence": edge.confidence,
                "source": edge.source,
            })

    return {"nodes": nodes, "edges": edges}


async def get_topic_by_id(
    session: AsyncSession,
    topic_id: int,
    domain: str = None,
) -> Optional[Topic]:
    """Find a topic by database ID."""
    stmt = select(Topic).where(Topic.id == topic_id)
    if domain:
        stmt = stmt.where(Topic.domain == domain)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_topic_by_topic_id(
    session: AsyncSession,
    domain: str,
    topic_id_str: str,
) -> Optional[Topic]:
    """Find a topic by its unique string identifier (from JSON)."""
    stmt = select(Topic).where(
        Topic.domain == domain,
        Topic.topic_id == topic_id_str,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_prerequisites(
    session: AsyncSession,
    topic_db_id: int,
) -> list[Topic]:
    """Get all prerequisite topics for a given topic."""
    stmt = (
        select(Topic)
        .join(TopicEdge, Topic.id == TopicEdge.prerequisite_id)
        .where(TopicEdge.topic_id == topic_db_id)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_dependents(
    session: AsyncSession,
    topic_db_id: int,
) -> list[Topic]:
    """Get all topics that depend on (have as prerequisite) a given topic."""
    stmt = (
        select(Topic)
        .join(TopicEdge, Topic.id == TopicEdge.topic_id)
        .where(TopicEdge.prerequisite_id == topic_db_id)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_subtopics(
    session: AsyncSession,
    topic_db_id: int,
) -> list[Subtopic]:
    """Get all subtopics for a given topic."""
    stmt = (
        select(Subtopic)
        .where(Subtopic.topic_id == topic_db_id)
        .order_by(Subtopic.subtopic_index)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def load_syllabus_json() -> dict:
    """Load the syllabus from the topics_full.json file."""
    path = settings.syllabus_path
    if not os.path.exists(path):
        # Fall back to looking relative to project root
        path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "topics_full.json")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


async def seed_from_syllabus(session: AsyncSession):
    """Seed the database from the syllabus JSON.

    Safe to call on every startup (idempotent via topic_id uniqueness check).
    Creates topics, subtopics, and prerequisite edges from the JSON structure.
    """
    domain = settings.default_domain
    data = await load_syllabus_json()

    topic_map: dict[str, int] = {}  # topic_id -> db id

    sort_order = 0
    for module_idx, module in enumerate(data.get("modules", [])):
        module_name = module.get("module", f"Module {module_idx + 1}")
        for topic_data in module.get("topics", []):
            topic_id_str = topic_data.get("id", "")
            title = topic_data.get("title", "")

            # Check if topic already exists
            existing = await get_topic_by_topic_id(session, domain, topic_id_str)
            if existing:
                topic_map[topic_id_str] = existing.id
                continue

            topic = Topic(
                domain=domain,
                module=module_name,
                topic_id=topic_id_str,
                title=title,
                description="",
                source="syllabus",
                sort_order=sort_order,
            )
            session.add(topic)
            await session.flush()
            topic_map[topic_id_str] = topic.id

            # Create subtopics
            for si, subtopic_title in enumerate(topic_data.get("subtopics", [])):
                subtopic = Subtopic(
                    topic_id=topic.id,
                    title=subtopic_title,
                    subtopic_index=si,
                )
                session.add(subtopic)

            sort_order += 1

    # Create prerequisite edges
    for module in data.get("modules", []):
        for topic_data in module.get("topics", []):
            topic_id_str = topic_data.get("id", "")
            prereq_ids = topic_data.get("prerequisites", [])

            if not prereq_ids:
                continue

            topic_db_id = topic_map.get(topic_id_str)
            if not topic_db_id:
                continue

            for prereq_id_str in prereq_ids:
                prereq_db_id = topic_map.get(prereq_id_str)
                if not prereq_db_id:
                    logger.warning("Prerequisite '%s' not found for topic '%s'", prereq_id_str, topic_id_str)
                    continue

                # Check if edge already exists
                stmt = select(TopicEdge).where(
                    TopicEdge.topic_id == topic_db_id,
                    TopicEdge.prerequisite_id == prereq_db_id,
                )
                result = await session.execute(stmt)
                if not result.scalar_one_or_none():
                    edge = TopicEdge(
                        topic_id=topic_db_id,
                        prerequisite_id=prereq_db_id,
                        source="syllabus",
                    )
                    session.add(edge)

    await session.flush()
    total_topics = len(topic_map)
    count_stmt = select(func.count(TopicEdge.id)).where(TopicEdge.source == "syllabus")
    total_edges = await session.scalar(count_stmt)

    logger.info(
        "Seeded syllabus '%s': %d topics, %d edges across %d modules",
        data.get("roadmap", "unknown"),
        total_topics,
        total_edges or 0,
        len(data.get("modules", [])),
    )

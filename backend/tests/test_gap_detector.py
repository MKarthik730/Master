"""Tests for the gap detection algorithm.

Coverage:
  - No gaps when all topics are covered
  - Detects gaps from uncovered prerequisites
  - Chained prerequisites produce correct gap order
  - Subtopic roll-up correctly marks topics covered
  - Empty domain returns no gaps
"""

import pytest
from sqlalchemy import select

from app.models import Progress, Subtopic, Topic, TopicEdge
from app.services.gap_detector import detect_gaps
from app.services.graph_service import seed_from_syllabus


async def _seed_minimal_graph(session):
    """Seed a minimal 4-topic graph: A → B → C, D (independent)."""
    topic_a = Topic(domain="test_domain", module="Module 1", topic_id="topic_a", title="Topic A", sort_order=0)
    topic_b = Topic(domain="test_domain", module="Module 1", topic_id="topic_b", title="Topic B", sort_order=1)
    topic_c = Topic(domain="test_domain", module="Module 1", topic_id="topic_c", title="Topic C", sort_order=2)
    topic_d = Topic(domain="test_domain", module="Module 2", topic_id="topic_d", title="Topic D", sort_order=3)
    session.add_all([topic_a, topic_b, topic_c, topic_d])
    await session.flush()

    # Edges: A→B, B→C
    session.add_all([
        TopicEdge(topic_id=topic_b.id, prerequisite_id=topic_a.id),
        TopicEdge(topic_id=topic_c.id, prerequisite_id=topic_b.id),
    ])
    await session.flush()

    return {"A": topic_a, "B": topic_b, "C": topic_c, "D": topic_d}


@pytest.mark.asyncio
async def test_no_gaps_when_all_covered(session):
    """All topics covered → no gaps detected."""
    topics = await _seed_minimal_graph(session)

    # Mark all topics covered
    for t in topics.values():
        session.add(Progress(domain="test_domain", topic_id=t.id, status="covered"))
    await session.flush()

    gaps = await detect_gaps(session, "test_domain")
    assert gaps == []


@pytest.mark.asyncio
async def test_detects_gap_from_uncovered_prerequisite(session):
    """B is covered, A is not → A is a gap (prerequisite for B)."""
    topics = await _seed_minimal_graph(session)

    # Only cover B
    session.add(Progress(domain="test_domain", topic_id=topics["B"].id, status="covered"))
    await session.flush()

    gaps = await detect_gaps(session, "test_domain")
    assert len(gaps) == 1
    assert gaps[0]["topic"]["name"] == "Topic A"
    assert "Topic B" in gaps[0]["prerequisite_for"]


@pytest.mark.asyncio
async def test_chained_prerequisites(session):
    """A → B → C, only C is covered → both A and B are gaps."""
    topics = await _seed_minimal_graph(session)

    session.add(Progress(domain="test_domain", topic_id=topics["C"].id, status="covered"))
    await session.flush()

    gaps = await detect_gaps(session, "test_domain")
    # A and B should be gaps
    gap_names = {g["topic"]["name"] for g in gaps}
    assert gap_names == {"Topic A", "Topic B"}, f"Expected A and B, got {gap_names}"


@pytest.mark.asyncio
async def test_independent_topics_not_gaps(session):
    """D has no prerequisites and is uncovered → not a gap."""
    topics = await _seed_minimal_graph(session)

    session.add(Progress(domain="test_domain", topic_id=topics["A"].id, status="covered"))
    await session.flush()

    gaps = await detect_gaps(session, "test_domain")
    gap_names = {g["topic"]["name"] for g in gaps}
    assert "Topic D" not in gap_names


@pytest.mark.asyncio
async def test_subtopic_rollup_marks_topic_covered(session):
    """All subtopics of A are covered → A is covered → no gap when A is prerequisite."""
    topics = await _seed_minimal_graph(session)

    # Add subtopics to A
    sub_a1 = Subtopic(topic_id=topics["A"].id, title="A1", subtopic_index=0)
    sub_a2 = Subtopic(topic_id=topics["A"].id, title="A2", subtopic_index=1)
    session.add_all([sub_a1, sub_a2])
    await session.flush()

    # Cover both subtopics of A
    session.add_all([
        Progress(domain="test_domain", topic_id=topics["A"].id, subtopic_id=sub_a1.id, status="covered"),
        Progress(domain="test_domain", topic_id=topics["A"].id, subtopic_id=sub_a2.id, status="covered"),
    ])
    await session.flush()

    gaps = await detect_gaps(session, "test_domain")
    # A is covered via subtopic rollup, B has A as prereq → B should be the gap
    gap_names = {g["topic"]["name"] for g in gaps}
    assert "Topic A" not in gap_names
    assert "Topic B" in gap_names


@pytest.mark.asyncio
async def test_empty_domain(session):
    """No topics in the domain → no gaps."""
    gaps = await detect_gaps(session, "nonexistent_domain")
    assert gaps == []

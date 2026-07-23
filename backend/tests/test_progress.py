"""Tests for progress roll-up logic and endpoints.

Coverage:
  - Subtopic-level updates roll up to topic-level status
  - Progress tree endpoint returns correct counts
  - Marking all subtopics covered → topic is 'covered'
  - Partial subtopic progress → topic is 'in_progress'
  - Prerequisite status affects topic availability
"""

import pytest
from sqlalchemy import select

from app.models import Progress, Subtopic, Topic, TopicEdge
from app.services.graph_service import get_topic_tree


async def _seed_test_graph(session):
    """Seed a 2-topic graph: A → B, each with 2 subtopics."""
    topic_a = Topic(domain="test_domain", module="Module 1", topic_id="topic_a", title="Topic A", sort_order=0)
    topic_b = Topic(domain="test_domain", module="Module 1", topic_id="topic_b", title="Topic B", sort_order=1)
    session.add_all([topic_a, topic_b])
    await session.flush()

    # A → B edge
    session.add(TopicEdge(topic_id=topic_b.id, prerequisite_id=topic_a.id))
    await session.flush()

    # Subtopics for A
    sub_a1 = Subtopic(topic_id=topic_a.id, title="A1", subtopic_index=0)
    sub_a2 = Subtopic(topic_id=topic_a.id, title="A2", subtopic_index=1)
    # Subtopics for B
    sub_b1 = Subtopic(topic_id=topic_b.id, title="B1", subtopic_index=0)
    sub_b2 = Subtopic(topic_id=topic_b.id, title="B2", subtopic_index=1)
    session.add_all([sub_a1, sub_a2, sub_b1, sub_b2])
    await session.flush()

    return {
        "A": topic_a, "B": topic_b,
        "A1": sub_a1, "A2": sub_a2,
        "B1": sub_b1, "B2": sub_b2,
    }


@pytest.mark.asyncio
async def test_all_subtopics_covered_rolls_up_to_covered(session):
    """All subtopics covered → topic status is 'covered'."""
    graph = await _seed_test_graph(session)

    # Cover all subtopics of A
    session.add_all([
        Progress(domain="test_domain", topic_id=graph["A"].id, subtopic_id=graph["A1"].id, status="covered"),
        Progress(domain="test_domain", topic_id=graph["A"].id, subtopic_id=graph["A2"].id, status="covered"),
    ])
    await session.flush()

    tree = await get_topic_tree(session, "test_domain")
    a_node = next(t for t in tree if t["id"] == graph["A"].id)
    assert a_node["status"] == "covered"


@pytest.mark.asyncio
async def test_partial_subtopics_in_progress(session):
    """Some subtopics covered, some not → topic is 'in_progress'."""
    graph = await _seed_test_graph(session)

    session.add_all([
        Progress(domain="test_domain", topic_id=graph["A"].id, subtopic_id=graph["A1"].id, status="covered"),
        # A2 remains uncovered
    ])
    await session.flush()

    tree = await get_topic_tree(session, "test_domain")
    a_node = next(t for t in tree if t["id"] == graph["A"].id)
    assert a_node["status"] == "in_progress"


@pytest.mark.asyncio
async def test_no_subtopics_covered_is_available(session):
    """No progress on any subtopics → topic is 'available'."""
    graph = await _seed_test_graph(session)

    tree = await get_topic_tree(session, "test_domain")
    a_node = next(t for t in tree if t["id"] == graph["A"].id)
    # A has no prerequisites and no progress → available
    assert a_node["status"] == "available"


@pytest.mark.asyncio
async def test_prerequisite_uncovered_locks_dependent(session):
    """A's prerequisite B is uncovered → A is 'available', B is 'locked'."""
    graph = await _seed_test_graph(session)

    tree = await get_topic_tree(session, "test_domain")
    b_node = next(t for t in tree if t["id"] == graph["B"].id)
    assert b_node["status"] == "locked"  # B depends on A, A is not covered


@pytest.mark.asyncio
async def test_covering_prerequisite_unlocks_dependent(session):
    """Cover A → B becomes unlocked."""
    graph = await _seed_test_graph(session)

    # Cover A's subtopics
    session.add_all([
        Progress(domain="test_domain", topic_id=graph["A"].id, subtopic_id=graph["A1"].id, status="covered"),
        Progress(domain="test_domain", topic_id=graph["A"].id, subtopic_id=graph["A2"].id, status="covered"),
    ])
    await session.flush()

    tree = await get_topic_tree(session, "test_domain")
    b_node = next(t for t in tree if t["id"] == graph["B"].id)
    assert b_node["status"] != "locked"  # B should now be available or in_progress


@pytest.mark.asyncio
async def test_progress_endpoint_returns_counts(session):
    """The progress tree endpoint returns correct summary counts."""
    from app.routers.progress import get_progress_tree

    graph = await _seed_test_graph(session)

    # Cover A partially
    session.add_all([
        Progress(domain="test_domain", topic_id=graph["A"].id, subtopic_id=graph["A1"].id, status="covered"),
    ])
    await session.flush()

    response = await get_progress_tree(domain="test_domain", session=session)
    assert response.total_topics == 2
    assert response.covered == 0  # no topic is fully covered yet
    assert response.in_progress == 1  # A is in_progress
    assert response.locked == 1  # B is locked (A is not fully covered)
    assert response.available == 0


@pytest.mark.asyncio
async def test_subtopic_update_via_endpoint(session):
    """POST /progress/{domain}/subtopic updates progress correctly."""
    from app.routers.progress import update_subtopic_progress
    from app.routers.progress import UpdateSubtopicRequest

    graph = await _seed_test_graph(session)

    # Update A1 to covered
    req = UpdateSubtopicRequest(subtopic_id=graph["A1"].id, status="covered")
    response = await update_subtopic_progress(domain="test_domain", request=req, session=session)
    assert response.subtopic_id == graph["A1"].id
    assert response.status == "covered"
    assert response.topic_progress > 0.0

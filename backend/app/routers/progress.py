"""Progress endpoints — get/update study progress for the syllabus tracker."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Progress, Topic, Subtopic
from app.services.graph_service import get_subtopics, get_topic_tree

router = APIRouter(prefix="/progress", tags=["progress"])


class ProgressItem(BaseModel):
    topic_id: str
    topic_name: str
    status: str
    subtopic_progress: list[dict] = []


class TopicTreeNode(BaseModel):
    id: int
    topic_id: str
    title: str
    module: str
    status: str
    subtopics: list[dict] = []
    prerequisites: list[str] = []
    prerequisite_titles: list[str] = []


class TopicTreeResponse(BaseModel):
    domain: str
    modules: list[dict]  # [{ "name": str, "topics": [TopicTreeNode] }]
    total_topics: int
    covered: int
    in_progress: int
    locked: int
    available: int


@router.get("/tree", response_model=TopicTreeResponse)
async def get_progress_tree(
    domain: str = settings.default_domain,
    session: AsyncSession = Depends(get_db),
):
    """Get the full topic tree with progress status for the syllabus tracker."""
    tree = await get_topic_tree(session, domain)

    # Group by module
    module_map: dict[str, list] = {}
    for node in tree:
        mod = node["module"]
        if mod not in module_map:
            module_map[mod] = []
        module_map[mod].append(TopicTreeNode(**node))

    modules = [
        {"name": name, "topics": topics}
        for name, topics in module_map.items()
    ]

    covered = sum(1 for t in tree if t["status"] == "covered")
    in_progress = sum(1 for t in tree if t["status"] == "in_progress")
    locked = sum(1 for t in tree if t["status"] == "locked")
    available = sum(1 for t in tree if t["status"] == "available")

    return TopicTreeResponse(
        domain=domain,
        modules=modules,
        total_topics=len(tree),
        covered=covered,
        in_progress=in_progress,
        locked=locked,
        available=available,
    )


class UpdateSubtopicRequest(BaseModel):
    subtopic_id: int
    status: str = Field(..., pattern="^(covered|in_progress|locked)$")


class UpdateSubtopicResponse(BaseModel):
    subtopic_id: int
    status: str
    topic_status: str
    topic_progress: float  # 0.0 - 1.0


@router.post("/{domain}/subtopic", response_model=UpdateSubtopicResponse)
async def update_subtopic_progress(
    domain: str,
    request: UpdateSubtopicRequest,
    session: AsyncSession = Depends(get_db),
):
    """Update progress for a single subtopic.

    Returns the updated topic status and progress percentage.
    """
    # Check subtopic exists
    sub_stmt = select(Subtopic).where(Subtopic.id == request.subtopic_id)
    sub_result = await session.execute(sub_stmt)
    subtopic = sub_result.scalar_one_or_none()
    if not subtopic:
        raise HTTPException(status_code=404, detail="Subtopic not found")

    # Upsert progress
    stmt = select(Progress).where(
        Progress.domain == domain,
        Progress.subtopic_id == request.subtopic_id,
    )
    result = await session.execute(stmt)
    progress = result.scalar_one_or_none()

    if progress:
        progress.status = request.status
    else:
        progress = Progress(
            domain=domain,
            topic_id=subtopic.topic_id,
            subtopic_id=request.subtopic_id,
            status=request.status,
            source="manual_entry",
        )
        session.add(progress)

    await session.flush()

    # Compute topic-level status
    all_subtopics = await get_subtopics(session, subtopic.topic_id)
    sub_stmt = select(Progress).where(
        Progress.topic_id == subtopic.topic_id,
        Progress.domain == domain,
        Progress.subtopic_id.isnot(None),
    )
    sub_result = await session.execute(sub_stmt)
    sub_progress = sub_result.scalars().all()
    sub_status_map = {p.subtopic_id: p.status for p in sub_progress}

    covered_count = sum(1 for s in all_subtopics if sub_status_map.get(s.id) == "covered")
    topic_progress = covered_count / len(all_subtopics) if all_subtopics else 0.0

    if topic_progress >= 1.0:
        topic_status = "covered"
    elif topic_progress > 0:
        topic_status = "in_progress"
    else:
        topic_status = "available"

    return UpdateSubtopicResponse(
        subtopic_id=request.subtopic_id,
        status=request.status,
        topic_status=topic_status,
        topic_progress=topic_progress,
    )

"""Progress endpoints — get current study progress for a domain."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Progress, Topic

router = APIRouter(prefix="/progress", tags=["progress"])


class ProgressItem(BaseModel):
    topic_id: str
    topic_name: str
    status: str
    source: str
    updated_at: str


class ProgressResponse(BaseModel):
    domain: str
    total_topics: int
    covered: int
    in_progress: int
    gap_count: int
    topics: list[ProgressItem]


@router.get("/{domain}", response_model=ProgressResponse)
async def get_progress(
    domain: str,
    session: AsyncSession = Depends(get_db),
):
    """Get current progress state for a domain.

    Joins Progress with Topic to return topic names alongside status.
    """
    # Get all topics for the domain
    total_stmt = select(Topic).where(Topic.domain == domain)
    total_result = await session.execute(total_stmt)
    all_topics = {str(t.id): t.name for t in total_result.scalars().all()}

    # Get progress records with topic names via join
    progress_stmt = (
        select(Progress, Topic.name.label("topic_name"))
        .join(Topic, Progress.topic_id == Topic.id, isouter=True)
        .where(Progress.domain == domain)
    )
    result = await session.execute(progress_stmt)
    rows = result.mappings().all()

    topics_list = []
    for row in rows:
        topics_list.append(
            ProgressItem(
                topic_id=str(row["topic_id"]),
                topic_name=row["topic_name"] or "Unknown",
                status=row["status"],
                source=row["source"],
                updated_at=row["updated_at"].isoformat() if row["updated_at"] else "",
            )
        )

    covered = sum(1 for r in rows if r["status"] == "covered")
    in_progress = sum(1 for r in rows if r["status"] == "in_progress")
    gap_count = sum(1 for r in rows if r["status"] == "gap")

    return ProgressResponse(
        domain=domain,
        total_topics=len(all_topics),
        covered=covered,
        in_progress=in_progress,
        gap_count=gap_count,
        topics=topics_list,
    )


class UpdateProgressRequest(BaseModel):
    topic_id: str = Field(..., description="UUID of the topic")
    status: str = Field(..., pattern="^(covered|in_progress|gap)$")


@router.post("/{domain}/update")
async def update_progress(
    domain: str,
    request: UpdateProgressRequest,
    session: AsyncSession = Depends(get_db),
):
    """Update progress status for a specific topic."""
    stmt = select(Progress).where(
        Progress.domain == domain,
        Progress.topic_id == UUID(request.topic_id),
    )
    result = await session.execute(stmt)
    progress = result.scalar_one_or_none()

    if progress:
        progress.status = request.status
    else:
        progress = Progress(
            domain=domain,
            topic_id=UUID(request.topic_id),
            status=request.status,
            source="manual_entry",
        )
        session.add(progress)

    await session.flush()
    return {"status": "updated"}

"""Gap detection endpoints — computed gaps with explanations."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.gap_detector import detect_gaps

router = APIRouter(prefix="/gaps", tags=["gaps"])


class GapTopic(BaseModel):
    id: str
    name: str
    description: str = ""
    module: str = ""


class GapItem(BaseModel):
    topic: GapTopic
    prerequisite_for: list[str]
    covered_by: list[str]
    explanation: str
    suggested_order: int


class GapsResponse(BaseModel):
    domain: str
    total_gaps: int
    gaps: list[GapItem]


@router.get("/{domain}", response_model=GapsResponse)
async def get_gaps(
    domain: str,
    session: AsyncSession = Depends(get_db),
):
    """Get computed study gaps."""
    if domain == "default":
        domain = settings.default_domain
    gaps = await detect_gaps(session, domain)

    return GapsResponse(
        domain=domain,
        total_gaps=len(gaps),
        gaps=[GapItem(**g) for g in gaps],
    )

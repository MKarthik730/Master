"""Progress model — tracks what topics a user has studied."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Progress(Base):
    __tablename__ = "progress"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="gap"
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="hardcoded_seed")
    notes: Mapped[str] = mapped_column(nullable=True)
    topic = relationship("Topic", foreign_keys=[topic_id])

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

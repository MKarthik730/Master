"""Progress model — tracks what topics/subtopics a user has studied."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Progress(Base):
    """Tracks progress at the subtopic level.

    Completion rolls up: all subtopics done → topic is 'covered'.
    """

    __tablename__ = "progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    topic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    subtopic_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("subtopics.id", ondelete="CASCADE"), nullable=True,
        comment="NULL means topic-level progress; non-NULL means subtopic-level"
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="locked"
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    notes: Mapped[str] = mapped_column(nullable=True)

    topic = relationship("Topic", foreign_keys=[topic_id])
    subtopic = relationship("Subtopic", foreign_keys=[subtopic_id])

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

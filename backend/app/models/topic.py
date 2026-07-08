"""Topic and TopicEdge models — the knowledge graph."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="manual"
    )
    confidence: Mapped[float] = mapped_column(Float, default=1.0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    incoming_edges = relationship(
        "TopicEdge",
        foreign_keys="TopicEdge.topic_id",
        back_populates="topic",
        cascade="all, delete-orphan",
    )
    outgoing_edges = relationship(
        "TopicEdge",
        foreign_keys="TopicEdge.prerequisite_id",
        back_populates="prerequisite",
        cascade="all, delete-orphan",
    )


class TopicEdge(Base):
    __tablename__ = "topic_edges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    prerequisite_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    source: Mapped[str] = mapped_column(String(50), default="manual")

    topic = relationship(
        "Topic", foreign_keys=[topic_id], back_populates="incoming_edges"
    )
    prerequisite = relationship(
        "Topic", foreign_keys=[prerequisite_id], back_populates="outgoing_edges"
    )

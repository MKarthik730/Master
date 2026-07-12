"""Topic and TopicEdge models — the knowledge graph for syllabus tracking."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    module: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    topic_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Unique ID from syllabus JSON (e.g., 'discrete_math')"
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="syllabus")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    prerequisite_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    source: Mapped[str] = mapped_column(String(50), default="syllabus")

    topic = relationship(
        "Topic", foreign_keys=[topic_id], back_populates="incoming_edges"
    )
    prerequisite = relationship(
        "Topic", foreign_keys=[prerequisite_id], back_populates="outgoing_edges"
    )


class Subtopic(Base):
    """Individual subtopic within a topic — tracks granular progress."""

    __tablename__ = "subtopics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    subtopic_index: Mapped[int] = mapped_column(Integer, default=0)

    topic = relationship("Topic", backref="subtopics")

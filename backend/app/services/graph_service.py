"""Knowledge graph service — topic and edge CRUD plus traversal."""

import logging
import uuid
from typing import list, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.select import select

from app.models import Topic, TopicEdge

logger = logging.getLogger(__name__)


async def get_full_graph(
    session: AsyncSession,
    domain: str,
) -> dict:
    """Fetch all topics and edges for a domain.

    Returns a dict suitable for graph visualization:
      { "nodes": [...], "edges": [...] }
    """
    # Fetch topics
    stmt = (
        select(Topic)
        .where(Topic.domain == domain)
        .options(selectinload(Topic.incoming_edges), selectinload(Topic.outgoing_edges))
    )
    result = await session.execute(stmt)
    topics = result.scalars().all()

    nodes = []
    for topic in topics:
        nodes.append({
            "id": str(topic.id),
            "name": topic.name,
            "description": topic.description,
            "source": topic.source,
            "confidence": topic.confidence,
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


async def get_topic_by_name(
    session: AsyncSession,
    domain: str,
    name: str,
) -> Optional[Topic]:
    """Find a topic by exact name within a domain."""
    stmt = select(Topic).where(
        Topic.domain == domain,
        Topic.name == name,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_topic(
    session: AsyncSession,
    topic_id: uuid.UUID,
) -> Optional[Topic]:
    """Get a single topic by ID."""
    stmt = (
        select(Topic)
        .where(Topic.id == topic_id)
        .options(selectinload(Topic.incoming_edges), selectinload(Topic.outgoing_edges))
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_prerequisites(
    session: AsyncSession,
    topic_id: uuid.UUID,
) -> list[Topic]:
    """Get all prerequisite topics for a given topic."""
    stmt = (
        select(Topic)
        .join(TopicEdge, Topic.id == TopicEdge.prerequisite_id)
        .where(TopicEdge.topic_id == topic_id)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_dependents(
    session: AsyncSession,
    topic_id: uuid.UUID,
) -> list[Topic]:
    """Get all topics that depend on (have as prerequisite) a given topic."""
    stmt = (
        select(Topic)
        .join(TopicEdge, Topic.id == TopicEdge.topic_id)
        .where(TopicEdge.prerequisite_id == topic_id)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def create_topic(
    session: AsyncSession,
    domain: str,
    name: str,
    description: str = None,
    source: str = "manual",
    confidence: float = 1.0,
) -> Topic:
    """Create a new topic node."""
    topic = Topic(
        domain=domain,
        name=name,
        description=description,
        source=source,
        confidence=confidence,
    )
    session.add(topic)
    await session.flush()
    return topic


async def create_edge(
    session: AsyncSession,
    topic_id: uuid.UUID,
    prerequisite_id: uuid.UUID,
    confidence: float = 1.0,
    source: str = "manual",
) -> TopicEdge:
    """Create a prerequisite edge between two topics."""
    edge = TopicEdge(
        topic_id=topic_id,
        prerequisite_id=prerequisite_id,
        confidence=confidence,
        source=source,
    )
    session.add(edge)
    await session.flush()
    return edge


async def seed_toc_graph(session: AsyncSession):
    """Seed the Theory of Computation knowledge graph.

    Topics and their prerequisite relationships based on standard TOC ordering.
    """
    topics_data = [
        ("fundamentals", "Basic mathematical concepts: sets, functions, relations, induction, alphabets, strings, languages"),
        ("regular_languages", "Regular languages: definition, closure properties, pumping lemma"),
        ("finite_automata_dfa", "Deterministic Finite Automata (DFA): formal definition, design, minimization"),
        ("finite_automata_nfa", "Nondeterministic Finite Automata (NFA): definition, epsilon transitions, NFA to DFA conversion"),
        ("regular_expressions", "Regular expressions: syntax, semantics, equivalence to finite automata"),
        ("context_free_grammars", "Context-Free Grammars (CFG): formal definition, derivation trees, ambiguity"),
        ("cfg_simplification", "CFG simplification: removing useless symbols, epsilon productions, unit productions"),
        ("normal_forms_cnf_gnf", "Normal forms: Chomsky Normal Form (CNF) and Greibach Normal Form (GNF)"),
        ("pushdown_automata", "Pushdown Automata (PDA): definition, design, equivalence with CFG"),
        ("turing_machines", "Turing Machines: formal definition, design, variants (multi-tape, nondeterministic)"),
        ("turing_machine_variants", "Turing Machine variants: multi-tape, nondeterministic, enumerators"),
        ("decidability", "Decidability: decidable problems, acceptance problem for DFAs/CFGs/TMs"),
        ("undecidability", "Undecidability: halting problem, Rice's theorem, reduction technique"),
        ("reductions", "Reductions: mapping reductions, Turing reductions, proving undecidability"),
        ("lba_cs", "Linear Bounded Automata (LBA) and Context-Sensitive Languages"),
        ("chomsky_hierarchy", "Chomsky hierarchy: Type 0-3 grammars, language class relationships"),
        ("pcp", "Post's Correspondence Problem: definition, undecidability proof, applications"),
        ("complexity_intro", "Introduction to Complexity: time complexity, P vs NP, NP-completeness"),
    ]

    # Edges: (topic_name, prerequisite_name)
    edge_data = [
        ("finite_automata_dfa", "fundamentals"),
        ("finite_automata_nfa", "finite_automata_dfa"),
        ("regular_expressions", "finite_automata_nfa"),
        ("regular_languages", "regular_expressions"),
        ("context_free_grammars", "regular_languages"),
        ("cfg_simplification", "context_free_grammars"),
        ("normal_forms_cnf_gnf", "cfg_simplification"),
        ("pushdown_automata", "normal_forms_cnf_gnf"),
        ("turing_machines", "pushdown_automata"),
        ("turing_machine_variants", "turing_machines"),
        ("decidability", "turing_machine_variants"),
        ("reductions", "decidability"),
        ("undecidability", "reductions"),
        ("lba_cs", "undecidability"),
        ("chomsky_hierarchy", "lba_cs"),
        ("chomsky_hierarchy", "normal_forms_cnf_gnf"),
        ("pcp", "undecidability"),
        ("complexity_intro", "undecidability"),
        ("complexity_intro", "turing_machines"),
    ]

    domain = "theory_of_computation"
    topic_map: dict[str, uuid.UUID] = {}

    # Create topics
    for name, description in topics_data:
        existing = await get_topic_by_name(session, domain, name)
        if existing:
            topic_map[name] = existing.id
            continue
        topic = await create_topic(session, domain, name, description, source="manual")
        topic_map[name] = topic.id

    # Create edges
    for topic_name, prereq_name in edge_data:
        if topic_name in topic_map and prereq_name in topic_map:
            # Check if edge already exists
            stmt = select(TopicEdge).where(
                TopicEdge.topic_id == topic_map[topic_name],
                TopicEdge.prerequisite_id == topic_map[prereq_name],
            )
            result = await session.execute(stmt)
            if not result.scalar_one_or_none():
                await create_edge(
                    session,
                    topic_id=topic_map[topic_name],
                    prerequisite_id=topic_map[prereq_name],
                )

    logger.info("Seeded TOC knowledge graph: %d topics, %d edges", len(topics_data), len(edge_data))

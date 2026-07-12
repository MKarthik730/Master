"""Graph endpoints — knowledge graph data for visualization."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.graph_service import get_full_graph

router = APIRouter(prefix="/graph", tags=["graph"])


class GraphNode(BaseModel):
    id: str
    name: str
    topic_id: str = ""
    module: str = ""
    description: str = ""
    source: str = "syllabus"
    confidence: float = 1.0
    dependency_count: int = 0


class GraphEdge(BaseModel):
    id: str
    from_node: str
    to: str
    confidence: float = 1.0
    source: str = "syllabus"


class GraphResponse(BaseModel):
    domain: str
    roadmap: str = ""
    nodes: list[GraphNode]
    edges: list[GraphEdge]


@router.get("/{domain}", response_model=GraphResponse)
async def get_graph(
    domain: str,
    session: AsyncSession = Depends(get_db),
):
    """Get the knowledge graph (topics + prerequisite edges) for a domain."""
    if domain == "default":
        domain = settings.default_domain
    graph = await get_full_graph(session, domain)

    return GraphResponse(
        domain=domain,
        roadmap=f"{domain.replace('_', ' ').title()} Syllabus",
        nodes=[GraphNode(**n) for n in graph["nodes"]],
        edges=[
            GraphEdge(
                id=e["id"],
                from_node=e["from"],
                to=e["to"],
                confidence=e["confidence"],
                source=e["source"],
            )
            for e in graph["edges"]
        ],
    )

# Study Gap Detector

A personal study gap-detection app that uses RAG + knowledge graphs to identify prerequisite gaps in your self-study.

## Architecture

```
Mobile PWA → FastAPI → PostgreSQL + pgvector + Redis
                 ↓
          LLM Gateway (Ollama → fallback API)
                 ↓
          Sentence Transformers (bge-small embeddings + cross-encoder reranker)
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- [Ollama](https://ollama.ai) with a model pulled (e.g., `ollama pull llama3.2`)

### Run

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** with pgvector extension on port `5432`
- **Redis 7** on port `6379`
- **FastAPI backend** on port `8000`

The backend auto-seeds the TOC knowledge graph and sample progress on startup.

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `POST /query` | Ask a RAG-grounded question |
| `GET /progress/{domain}` | Study progress state |
| `GET /gaps/{domain}` | Detected gaps with explanations |
| `GET /graph/{domain}` | Topic graph for visualization |
| `POST /ingest` | Upload a textbook PDF (dev use) |

### Frontend

Open `http://localhost:8000` in a browser, or serve the `frontend/` directory:

```bash
npx serve frontend/
```

The PWA can be installed to your phone's home screen for a native-like experience.

## Configuration

Copy `backend/.env.example` to `backend/.env` and adjust:

```bash
# Required: set your fallback API key for higher quality answers
FALLBACK_API_KEY=sk-...
```

## Data Model

- **documents** — ground-truth textbook PDFs
- **chunks** — text chunks with pgvector embeddings
- **topics** — knowledge graph nodes
- **topic_edges** — prerequisite relationships
- **progress** — what you've studied

## Phase 1 Features

- ☑ RAG pipeline: heading-aware chunking → bge-small embeddings → hybrid retrieval → cross-encoder reranker → LLM generation with citations
- ☑ TOC knowledge graph (18 topics, 19 prerequisite edges)
- ☑ Gap detection with RAG-grounded explanations
- ☑ PWA mobile UI (chat, gaps dashboard, interactive graph)
- ☑ Docker Compose setup
- ☑ LLM Gateway: Ollama local → configurable fallback API
- ☑ PDF ingestion

"""Application configuration via environment variables."""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Settings:
    # Database
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/study_gap",
    )
    db_echo: bool = os.getenv("DB_ECHO", "false").lower() == "true"

    # Redis
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Embedding model
    embedding_model_name: str = os.getenv(
        "EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"
    )
    embedding_dim: int = int(os.getenv("EMBEDDING_DIM", "384"))

    # Reranker
    reranker_model_name: str = os.getenv(
        "RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2"
    )

    # LLM Gateway
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen3:8b")

    fallback_api_key: Optional[str] = os.getenv("FALLBACK_API_KEY")
    fallback_api_url: str = os.getenv(
        "FALLBACK_API_URL", "https://api.openai.com/v1"
    )
    fallback_model: str = os.getenv("FALLBACK_MODEL", "gpt-4o-mini")

    # Chunking
    chunk_target_tokens: int = int(os.getenv("CHUNK_TARGET_TOKENS", "400"))
    chunk_overlap_tokens: int = int(os.getenv("CHUNK_OVERLAP_TOKENS", "50"))

    # Retrieval
    top_k_dense: int = int(os.getenv("TOP_K_DENSE", "20"))
    top_k_sparse: int = int(os.getenv("TOP_K_SPARSE", "20"))
    top_k_rerank: int = int(os.getenv("TOP_K_RERANK", "10"))
    final_k: int = int(os.getenv("FINAL_K", "5"))

    # Hybrid search weights
    dense_weight: float = float(os.getenv("DENSE_WEIGHT", "0.5"))
    sparse_weight: float = float(os.getenv("SPARSE_WEIGHT", "0.5"))

    # Default domain
    default_domain: str = os.getenv("DEFAULT_DOMAIN", "theory_of_computation")

    # App
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "*").split(",")
    )


settings = Settings()

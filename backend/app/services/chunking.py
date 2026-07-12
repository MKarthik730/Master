"""Heading/section-aware text chunker.

Splits textbook PDF text by sub-sections (## or ### markdown headings)
or by common textbook heading patterns. Falls back to ~400-token
windows with overlap.
"""

import logging
import re
from typing import Iterator

from app.config import settings

logger = logging.getLogger(__name__)

# Common heading patterns in textbooks
HEADING_PATTERNS = [
    re.compile(r"^#{1,3}\s+(.+)$", re.MULTILINE),  # Markdown headings
    re.compile(r"^(?:Section|Chapter|Topic)\s+[\d.]+[:\s]*(.+)$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^(\d+\.\d+\s+.*)$", re.MULTILINE),  # "1.1 Introduction"
    re.compile(r"^([A-Z][A-Z\s]+)$", re.MULTILINE),  # ALL CAPS headings
]

# Simple token counter (words + punctuation roughly)
def estimate_tokens(text: str) -> int:
    return len(text.split())


def extract_section_heading(text: str, position: int) -> str | None:
    """Try to find which section heading a position falls under."""
    # Walk backwards from position to find the nearest heading
    before = text[:position]
    lines = before.split("\n")
    for line in reversed(lines):
        stripped = line.strip()
        for pattern in HEADING_PATTERNS:
            m = pattern.match(stripped)
            if m:
                return m.group(1).strip()
    return None


def split_by_headings(text: str) -> list[dict]:
    """Split text by section headings. Returns list of {heading, content} dicts."""
    # Try to split by all heading patterns, find the one that works best
    sections = []
    lines = text.split("\n")
    current_heading = "Introduction"
    current_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        is_heading = False
        heading_text = None

        for pattern in HEADING_PATTERNS:
            m = pattern.match(stripped)
            if m:
                is_heading = True
                heading_text = m.group(1).strip()
                break

        if is_heading and current_lines:
            sections.append({
                "heading": current_heading,
                "content": "\n".join(current_lines).strip(),
            })
            current_heading = heading_text or current_heading
            current_lines = [line]
        else:
            current_lines.append(line)

    # Don't forget the last section
    if current_lines:
        sections.append({
            "heading": current_heading,
            "content": "\n".join(current_lines).strip(),
        })

    return [s for s in sections if len(s["content"]) > 20]  # Filter out tiny sections


def chunk_section(
    section: dict,
    target_tokens: int = None,
    overlap_tokens: int = None,
) -> list[dict]:
    """Split a single section into token-sized chunks with overlap if needed."""
    target_tokens = target_tokens or settings.chunk_target_tokens
    overlap_tokens = overlap_tokens or settings.chunk_overlap_tokens

    content = section["content"]
    tokens = content.split()
    total_tokens = len(tokens)

    if total_tokens <= target_tokens:
        return [{
            "content": content,
            "section_heading": section["heading"],
            "token_count": total_tokens,
        }]

    chunks = []
    start = 0
    chunk_index = 0

    while start < total_tokens:
        end = min(start + target_tokens, total_tokens)
        chunk_content = " ".join(tokens[start:end])
        chunks.append({
            "content": chunk_content,
            "section_heading": section["heading"],
            "token_count": end - start,
            "chunk_index": chunk_index,
        })
        chunk_index += 1
        start = end - overlap_tokens
        if start < 0:
            start = 0

    return chunks


def chunk_text(
    text: str,
    target_tokens: int = None,
    overlap_tokens: int = None,
) -> list[dict]:
    """Main entry point: split textbook text into chunks.

    Returns list of dicts with keys:
        content, section_heading, token_count, chunk_index
    """
    target_tokens = target_tokens or settings.chunk_target_tokens
    overlap_tokens = overlap_tokens or settings.chunk_overlap_tokens

    # Step 1: Split by headings
    sections = split_by_headings(text)

    if len(sections) <= 1:
        # If heading-based splitting didn't work well, try a naive split
        logger.info("Heading-based split produced %d section(s); using windowed fallback", len(sections))
        return chunk_section(
            {"heading": "General", "content": text},
            target_tokens,
            overlap_tokens,
        )

    # Step 2: Further chunk each section if needed
    all_chunks = []
    for section in sections:
        section_chunks = chunk_section(section, target_tokens, overlap_tokens)
        all_chunks.extend(section_chunks)

    # Add chunk index sequentially
    for i, chunk in enumerate(all_chunks):
        if "chunk_index" not in chunk:
            chunk["chunk_index"] = i

    logger.info("Chunked text into %d chunks across %d sections", len(all_chunks), len(sections))
    return all_chunks

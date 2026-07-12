"""CLI entry point for the `master` command.

Installed globally via `uv tool install .` (or `pipx install .`).
Launches the FastAPI server and opens the browser.
"""

import argparse
import asyncio
import logging
import os
import sys
import webbrowser
import socket


def find_free_port(start=8000, end=9000):
    """Find a free port in the given range."""
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return 8000  # Fallback


def main():
    """Main entry point for the `master` CLI tool."""
    parser = argparse.ArgumentParser(
        description="Master — CSE Placement Prep Tool",
    )
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=0,
        help="Port to run the server on (default: auto)",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Don't open browser automatically",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug mode",
    )

    args = parser.parse_args()

    # Configure logging
    log_level = logging.DEBUG if args.debug else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # Find a free port if not specified
    port = args.port if args.port else find_free_port()

    # Check Ollama model availability before starting
    logger = logging.getLogger("master_cli")
    logger.info("Checking Ollama model availability...")
    try:
        from app.services.llm_gateway import check_ollama_model
        model_ok = asyncio.run(check_ollama_model())
        if not model_ok:
            logger.warning(
                "Ollama not reachable. Make sure it's running (`ollama serve`). "
                "The RAG pipeline will still work but won't use LLM generation."
            )
        else:
            logger.info("Ollama model ready")
    except Exception as e:
        logger.warning("Ollama check failed: %s", e)

    # Open browser
    url = f"http://{args.host}:{port}"
    if not args.no_browser:
        logger.info("Opening browser at %s", url)
        webbrowser.open(url)

    # Start the server
    logger.info("Starting Master server at %s", url)
    os.environ.setdefault("MASTER_PORT", str(port))

    # Run uvicorn
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=port,
        log_level="info" if not args.debug else "debug",
    )


if __name__ == "__main__":
    main()

"""Vercel entrypoint for the same-origin FastAPI application."""

from server.main import app

__all__ = ["app"]

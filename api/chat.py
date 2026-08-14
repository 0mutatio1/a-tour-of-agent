"""Vercel entrypoint for the same-origin chat API."""

from server.main import app

__all__ = ["app"]

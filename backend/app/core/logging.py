"""Structured logging setup for the Pilotly backend.

Provides JSON-like structured log output suitable for production log
aggregation (e.g. Cloud Logging, Datadog) while remaining human-readable
during local development.

Usage::

    from app.core.logging import setup_logging, get_logger

    setup_logging()  # call once at app startup
    logger = get_logger(__name__)
    logger.info("Processing webhook", extra={"ig_user_id": "123"})
"""

from __future__ import annotations

import logging
import sys
from typing import ClassVar


class StructuredFormatter(logging.Formatter):
    """Formatter that produces structured, single-line log entries.

    Output format (one line per record)::

        2026-06-24T12:00:00Z | INFO | app.core.security | Webhook verified | {"user_id": 42}

    Any key/value pairs passed via ``extra`` are appended as a JSON-like
    dict at the end of the line for easy grep / parsing.
    """

    # Keys injected by the stdlib that we don't want to echo in ``extra``
    _BUILTIN_ATTRS: ClassVar[set[str]] = {
        "args", "created", "exc_info", "exc_text", "filename", "funcName",
        "levelname", "levelno", "lineno", "message", "module", "msecs", "msg",
        "name", "pathname", "process", "processName", "relativeCreated",
        "stack_info", "thread", "threadName", "taskName",
    }

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        """Format a log record into a structured single-line string."""
        # Let the parent class handle %-style message interpolation
        record.message = record.getMessage()

        timestamp = self.formatTime(record, datefmt="%Y-%m-%dT%H:%M:%SZ")
        level = record.levelname.ljust(8)
        name = record.name
        message = record.message

        # Collect any user-supplied extra fields
        extras = {
            k: v
            for k, v in record.__dict__.items()
            if k not in self._BUILTIN_ATTRS and not k.startswith("_")
        }

        line = f"{timestamp} | {level} | {name} | {message}"
        if extras:
            line += f" | {extras}"

        # Append traceback if present
        if record.exc_info and not record.exc_text:
            record.exc_text = self.formatException(record.exc_info)
        if record.exc_text:
            line += f"\n{record.exc_text}"
        if record.stack_info:
            line += f"\n{record.stack_info}"

        return line


def setup_logging(level: int | str = logging.INFO) -> None:
    """Configure the root logger with :class:`StructuredFormatter`.

    Call this **once** during application startup (e.g. in ``app/main.py``).

    Args:
        level: Minimum log level to emit. Accepts ``logging.DEBUG``,
               ``"INFO"``, etc.
    """
    root = logging.getLogger()

    # Avoid duplicate handlers if called more than once (e.g. in tests)
    if root.handlers:
        return

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(StructuredFormatter())
    root.addHandler(handler)
    root.setLevel(level)

    # Quieten noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger.

    Convenience wrapper so callers don't need to import ``logging`` directly.

    Args:
        name: Logger name — usually ``__name__`` of the calling module.

    Returns:
        A ``logging.Logger`` instance.
    """
    return logging.getLogger(name)

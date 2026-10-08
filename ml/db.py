"""
Shared database connection for the ML batch jobs.

Deliberately reads apps/api/.env rather than a separate ml/.env - there is
exactly one DATABASE_URL for this project, and keeping ML and the Node
backend pointed at the same config file avoids them silently drifting
apart (e.g. one pointed at a stale local DB after a docker-compose reset).
"""

import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

_API_ENV_PATH = Path(__file__).resolve().parent.parent / "apps" / "api" / ".env"
load_dotenv(_API_ENV_PATH)


def _clean_database_url(raw_url: str) -> str:
    """
    Prisma's DATABASE_URL commonly includes a `schema=public` query
    parameter, which is a Prisma-specific convention - libpq (and
    SQLAlchemy's psycopg2 dialect) does not recognize it as a connection
    option and will reject the connection outright if it's passed through.
    This project only ever uses the default "public" Postgres schema, so
    the parameter is simply dropped here rather than translated, with a
    comment making that assumption explicit rather than silent.
    """
    parsed = urlparse(raw_url)
    query = parse_qs(parsed.query)
    query.pop("schema", None)
    cleaned = parsed._replace(query=urlencode(query, doseq=True))
    return urlunparse(cleaned)


def get_engine() -> Engine:
    raw_url = os.environ.get("DATABASE_URL")
    if not raw_url:
        raise RuntimeError(
            f"DATABASE_URL not found. Expected it in {_API_ENV_PATH} "
            "(copy apps/api/.env.example to apps/api/.env and fill it in)."
        )
    cleaned = _clean_database_url(raw_url)
    # SQLAlchemy 2.x resolves a bare "postgresql://" scheme to the
    # "psycopg" (v3) dialect by default if nothing more specific is given -
    # this project installs psycopg2-binary (requirements.txt), not
    # psycopg (v3), so the driver is made explicit here rather than relying
    # on SQLAlchemy's default resolution order, which caused exactly this
    # mismatch in practice (ModuleNotFoundError: No module named 'psycopg').
    if cleaned.startswith("postgresql://"):
        cleaned = cleaned.replace("postgresql://", "postgresql+psycopg2://", 1)
    return create_engine(cleaned)

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
from sqlalchemy import create_engine, text
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
    engine = create_engine(cleaned)
    _preflight(engine)
    return engine


_REQUIRED_TABLES = ("PriceObservation", "Market", "Commodity")
_announced = False


def _preflight(engine: Engine) -> None:
    """Say which database the jobs are using, and stop with a plain message if
    it is not one that holds the price data.

    The usual cause is a DATABASE_URL pointing somewhere unintended: a freshly
    created empty copy, a new hosted database that hasn't been loaded yet, or
    a mistyped database name. Without this check that surfaces as a long SQL
    traceback ("relation PriceObservation does not exist") that doesn't mention
    the real cause. Runs once per process, not once per job.
    """
    global _announced
    if _announced:
        return

    url = engine.url
    target = f"{url.database} on {url.host or 'local socket'}:{url.port or 5432}"

    with engine.connect() as conn:
        found = {
            row[0]
            for row in conn.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()")
            )
        }

    missing = [t for t in _REQUIRED_TABLES if t not in found]
    if missing:
        raise SystemExit(
            f"\nERROR: connected to database '{url.database}' on {url.host or 'local socket'}, "
            f"but it has no {', '.join(repr(t) for t in missing)} table(s).\n"
            f"Tables found there: {sorted(found) or 'none (the database is empty)'}\n\n"
            "Check that DATABASE_URL (in apps/api/.env, or exported in your shell, which takes "
            "precedence) points at the database that holds your price data, and that the "
            "migrations and data import have been run against it.\n"
        )

    print(f"Using database: {target}")
    _announced = True

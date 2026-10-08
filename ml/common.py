"""
Shared helpers for the ML batch jobs. Table/column names are quoted
exactly as Prisma generated them (camelCase), since this project doesn't
use @map - the actual Postgres identifiers are camelCase, not snake_case.
"""

import uuid
from dataclasses import dataclass

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine


def generate_id() -> str:
    """
    Prisma's `@default(cuid())` is applied by Prisma Client at the
    application layer, not as a Postgres column DEFAULT - there is no
    database-level default to rely on when inserting directly via SQL from
    Python. Prisma does not validate that an id is actually a cuid at the
    database level (no CHECK constraint), so any unique string works; a
    uuid4 hex string, prefixed to make its Python origin obvious when
    debugging, is used here rather than pulling in a cuid-compatible
    library for this alone.
    """
    return f"py_{uuid.uuid4().hex}"


@dataclass
class PriceSeries:
    market_id: str
    commodity_id: str
    market_name: str
    commodity_name: str
    df: pd.DataFrame  # columns: date (datetime64), price (float)


def fetch_pairs_with_min_history(engine: Engine, min_points: int) -> list[tuple[str, str, str, str, int]]:
    """Returns (marketId, commodityId, marketName, commodityName, pointCount)
    for every pair with at least `min_points` distinct observation dates."""
    query = text(
        """
        SELECT po."marketId", po."commodityId", m."name" AS market_name,
               c."name" AS commodity_name, COUNT(DISTINCT po."date") AS point_count
        FROM "PriceObservation" po
        JOIN "Market" m ON m."id" = po."marketId"
        JOIN "Commodity" c ON c."id" = po."commodityId"
        GROUP BY po."marketId", po."commodityId", m."name", c."name"
        HAVING COUNT(DISTINCT po."date") >= :min_points
        ORDER BY point_count DESC
        """
    )
    with engine.connect() as conn:
        rows = conn.execute(query, {"min_points": min_points}).fetchall()
    return [(r[0], r[1], r[2], r[3], r[4]) for r in rows]


def fetch_price_series(engine: Engine, market_id: str, commodity_id: str) -> pd.DataFrame:
    """One row per date (averaging multiple varieties/grades on the same
    day into a single daily price) - forecasting and anomaly detection
    both operate on a single daily series per market+commodity, not on
    the variety-level granularity the raw table stores."""
    query = text(
        """
        SELECT "date", AVG("price") AS price
        FROM "PriceObservation"
        WHERE "marketId" = :market_id AND "commodityId" = :commodity_id
        GROUP BY "date"
        ORDER BY "date" ASC
        """
    )
    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"market_id": market_id, "commodity_id": commodity_id})
    df["date"] = pd.to_datetime(df["date"])
    df["price"] = df["price"].astype(float)
    return df

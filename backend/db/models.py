"""
Database ORM row models — typed dataclasses matching each table.
Phase 1: plain Python dataclasses + psycopg2 for local Postgres.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Generator, Optional
from uuid import UUID

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))

# ---------------------------------------------------------------------------
# Connection pool (simple — single-process Phase 1)
# ---------------------------------------------------------------------------

_DB_DSN = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", 5432)),
    "dbname":   os.getenv("DB_NAME", "erp"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "Imran@812"),
}


@contextmanager
def get_conn() -> Generator[psycopg2.extensions.connection, None, None]:
    """Yield a psycopg2 connection with RealDictCursor; commit/rollback on exit."""
    conn = psycopg2.connect(**_DB_DSN, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_cursor() -> Generator[psycopg2.extensions.cursor, None, None]:
    """Yield a cursor directly (commits on success)."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            yield cur


# ---------------------------------------------------------------------------
# Row dataclasses
# ---------------------------------------------------------------------------

@dataclass
class Entity:
    id: str
    type: str  # 'vendor' | 'customer'
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class Item:
    id: str
    sku: str
    name: str
    unit_cost: float
    unit_price: float
    quantity_on_hand: int
    reorder_threshold: int
    description: Optional[str] = None
    category: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class Transaction:
    id: str
    type: str   # 'purchase_order' | 'sale' | 'stock_adjustment'
    status: str
    total_amount: float
    created_by: str
    entity_id: Optional[str] = None
    created_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    notes: Optional[str] = None


@dataclass
class LineItem:
    id: str
    transaction_id: str
    item_id: str
    quantity: int
    unit_price: float


@dataclass
class LedgerEntry:
    id: str
    entry_type: str   # 'debit' | 'credit'
    account: str      # 'cash' | 'inventory' | 'revenue' | 'expense'
    amount: float
    transaction_id: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class PendingAction:
    id: str
    action_type: str
    payload: dict
    summary: str
    proposed_by: str
    status: str = "pending"
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


@dataclass
class AuditLog:
    id: str
    actor: str
    action: str
    pending_action_id: Optional[str] = None
    detail: Optional[dict] = None
    created_at: Optional[datetime] = None

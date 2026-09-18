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


@dataclass
class Conversation:
    id: str
    title: str
    workspace_id: Optional[str] = None
    active_agent: str = "master"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    message_count: int = 0


@dataclass
class Message:
    id: str
    conversation_id: str
    role: str
    content: str
    agent: Optional[str] = None
    pending_action_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Conversation & Message DB Helpers
# ---------------------------------------------------------------------------

def create_conversation(title: str = "New Conversation", workspace_id: Optional[str] = None, active_agent: str = "master") -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO conversations (title, workspace_id, active_agent)
                VALUES (%s, %s, %s)
                RETURNING id, title, workspace_id, active_agent, created_at, updated_at;
                """,
                (title, workspace_id, active_agent)
            )
            row = cur.fetchone()
            return {
                "id": str(row["id"]),
                "title": row["title"],
                "workspace_id": row["workspace_id"],
                "active_agent": row["active_agent"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                "message_count": 0,
            }


def list_conversations(workspace_id: Optional[str] = None) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT
                    c.id, c.title, c.workspace_id, c.active_agent, c.created_at, c.updated_at,
                    COUNT(m.id) AS message_count,
                    (
                        SELECT content FROM messages
                        WHERE conversation_id = c.id
                        ORDER BY created_at DESC LIMIT 1
                    ) AS last_message
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
            """
            params = []
            if workspace_id:
                query += " WHERE c.workspace_id = %s"
                params.append(workspace_id)
            query += " GROUP BY c.id ORDER BY c.updated_at DESC;"
            cur.execute(query, params)
            rows = cur.fetchall()

            return [
                {
                    "id": str(r["id"]),
                    "title": r["title"],
                    "workspace_id": r["workspace_id"],
                    "active_agent": r["active_agent"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                    "message_count": int(r["message_count"]),
                    "last_message": r["last_message"],
                }
                for r in rows
            ]


def get_conversation(conversation_id: str) -> Optional[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, workspace_id, active_agent, created_at, updated_at
                FROM conversations
                WHERE id = %s;
                """,
                (conversation_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "id": str(row["id"]),
                "title": row["title"],
                "workspace_id": row["workspace_id"],
                "active_agent": row["active_agent"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }


def get_conversation_messages(conversation_id: str) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, conversation_id, role, content, agent, pending_action_id, metadata, created_at
                FROM messages
                WHERE conversation_id = %s
                ORDER BY created_at ASC;
                """,
                (conversation_id,)
            )
            rows = cur.fetchall()
            return [
                {
                    "id": str(r["id"]),
                    "conversation_id": str(r["conversation_id"]),
                    "role": r["role"],
                    "content": r["content"],
                    "agent": r["agent"],
                    "pending_action_id": str(r["pending_action_id"]) if r["pending_action_id"] else None,
                    "metadata": r["metadata"] or {},
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                }
                for r in rows
            ]


def save_message(
    conversation_id: str,
    role: str,
    content: str,
    agent: Optional[str] = None,
    pending_action_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    import json
    with get_conn() as conn:
        with conn.cursor() as cur:
            meta_json = json.dumps(metadata or {})
            cur.execute(
                """
                INSERT INTO messages (conversation_id, role, content, agent, pending_action_id, metadata)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                RETURNING id, conversation_id, role, content, agent, pending_action_id, metadata, created_at;
                """,
                (conversation_id, role, content, agent, pending_action_id, meta_json)
            )
            msg_row = cur.fetchone()

            # Update updated_at and optionally active_agent on conversation
            update_sql = "UPDATE conversations SET updated_at = now()"
            params = []
            if agent:
                update_sql += ", active_agent = %s"
                params.append(agent)
            update_sql += " WHERE id = %s;"
            params.append(conversation_id)
            cur.execute(update_sql, params)

            return {
                "id": str(msg_row["id"]),
                "conversation_id": str(msg_row["conversation_id"]),
                "role": msg_row["role"],
                "content": msg_row["content"],
                "agent": msg_row["agent"],
                "pending_action_id": str(msg_row["pending_action_id"]) if msg_row["pending_action_id"] else None,
                "metadata": msg_row["metadata"] or {},
                "created_at": msg_row["created_at"].isoformat() if msg_row["created_at"] else None,
            }


def update_conversation(conversation_id: str, title: Optional[str] = None, active_agent: Optional[str] = None) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            updates = []
            params = []
            if title is not None:
                updates.append("title = %s")
                params.append(title)
            if active_agent is not None:
                updates.append("active_agent = %s")
                params.append(active_agent)
            if not updates:
                return False
            updates.append("updated_at = now()")
            params.append(conversation_id)
            sql = f"UPDATE conversations SET {', '.join(updates)} WHERE id = %s;"
            cur.execute(sql, params)
            return cur.rowcount > 0


def delete_conversation(conversation_id: str) -> bool:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM conversations WHERE id = %s;", (conversation_id,))
            return cur.rowcount > 0

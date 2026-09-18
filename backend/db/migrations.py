"""
Database schema migrations for Agent-First ERP.
Adds:
- workspaces table and workspace_id foreign keys
- system_settings table
- prev_hash and entry_hash columns on audit_log with cryptographic hash chaining
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import sys

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.models import get_conn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migrations")

GENESIS_HASH = "0" * 64


def run_migrations():
    logger.info("Starting schema migrations...")
    with get_conn() as conn:
        with conn.cursor() as cur:
            # 1. Create workspaces table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS workspaces (
                    id         TEXT PRIMARY KEY,
                    name       TEXT NOT NULL,
                    code       TEXT NOT NULL,
                    env        TEXT NOT NULL CHECK (env IN ('Production', 'Staging', 'Sandbox')),
                    compute    INTEGER NOT NULL DEFAULT 50,
                    agents     INTEGER NOT NULL DEFAULT 5,
                    currency   TEXT NOT NULL DEFAULT 'INR',
                    symbol     TEXT NOT NULL DEFAULT '₹',
                    is_active  BOOLEAN NOT NULL DEFAULT false,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                );
                """
            )
            logger.info("Checked/created `workspaces` table.")

            # Seed the single production workspace. All ledger, inventory,
            # pending-action, and conversation rows belong to this workspace.
            # (Legacy mock workspaces are removed in step 7 below.)
            workspaces_seed = [
                ("ws-prd-0982-inr", "Main Production", "Node-01", "Production", 82, 5, "INR", "₹", True),
            ]
            for ws_id, name, code, env, compute, agents, curr, sym, active in workspaces_seed:
                cur.execute(
                    """
                    INSERT INTO workspaces (id, name, code, env, compute, agents, currency, symbol, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE
                    SET name = EXCLUDED.name,
                        code = EXCLUDED.code,
                        env = EXCLUDED.env,
                        compute = EXCLUDED.compute,
                        agents = EXCLUDED.agents,
                        currency = EXCLUDED.currency,
                        symbol = EXCLUDED.symbol;
                    """,
                    (ws_id, name, code, env, compute, agents, curr, sym, active),
                )
            logger.info("Seeded initial workspaces.")

            # 2. Add workspace_id columns to items, transactions, ledger, pending_actions
            tables_to_alter = ["items", "transactions", "ledger", "pending_actions"]
            for tbl in tables_to_alter:
                cur.execute(
                    f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_name = '{tbl}' AND column_name = 'workspace_id'
                        ) THEN
                            ALTER TABLE {tbl} ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);
                        END IF;
                    END $$;
                    """
                )
                # Backfill with default workspace
                cur.execute(
                    f"UPDATE {tbl} SET workspace_id = 'ws-prd-0982-inr' WHERE workspace_id IS NULL;"
                )
            logger.info("Checked/added `workspace_id` to items, transactions, ledger, pending_actions.")

            # 3. Create system_settings table
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS system_settings (
                    id              TEXT PRIMARY KEY DEFAULT 'default',
                    sign_off_limit  NUMERIC(12,2) NOT NULL DEFAULT 50000.00,
                    daily_cap       NUMERIC(12,2) NOT NULL DEFAULT 250000.00,
                    auto_replenish  BOOLEAN NOT NULL DEFAULT true,
                    polling_freq    INTEGER NOT NULL DEFAULT 5000,
                    updated_at      TIMESTAMPTZ DEFAULT now()
                );
                """
            )
            cur.execute(
                """
                INSERT INTO system_settings (id, sign_off_limit, daily_cap, auto_replenish, polling_freq)
                VALUES ('default', 50000.00, 250000.00, true, 5000)
                ON CONFLICT (id) DO NOTHING;
                """
            )
            logger.info("Checked/created `system_settings` table.")

            # 4. Add prev_hash and entry_hash to audit_log
            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'audit_log' AND column_name = 'prev_hash'
                    ) THEN
                        ALTER TABLE audit_log ADD COLUMN prev_hash TEXT;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'audit_log' AND column_name = 'entry_hash'
                    ) THEN
                        ALTER TABLE audit_log ADD COLUMN entry_hash TEXT;
                    END IF;
                END $$;
                """
            )
            logger.info("Checked/added hash columns to `audit_log`.")

            # 5. Backfill cryptographic hash chain for existing audit_log rows
            from confirmation.crypto_ledger import hash_entry

            cur.execute(
                """
                SELECT id, actor, action, detail, created_at, prev_hash, entry_hash
                FROM audit_log
                ORDER BY created_at ASC, id ASC;
                """
            )
            rows = cur.fetchall()

            current_prev_hash = GENESIS_HASH
            updates = 0
            for r in rows:
                entry_hash = hash_entry(current_prev_hash, r["actor"], r["action"], r.get("detail"), r["created_at"])

                cur.execute(
                    """
                    UPDATE audit_log
                    SET prev_hash = %s, entry_hash = %s
                    WHERE id = %s;
                    """,
                    (current_prev_hash, entry_hash, r["id"]),
                )
                current_prev_hash = entry_hash
                updates += 1

            logger.info("Cryptographic audit log chain verified/backfilled (%d entries updated).", updates)

            # 6. Create conversations and messages tables for chat history persistence
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    workspace_id TEXT REFERENCES workspaces(id),
                    title        TEXT NOT NULL,
                    active_agent TEXT DEFAULT 'master',
                    created_at   TIMESTAMPTZ DEFAULT now(),
                    updated_at   TIMESTAMPTZ DEFAULT now()
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                    role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                    content           TEXT NOT NULL,
                    agent             TEXT,
                    pending_action_id UUID REFERENCES pending_actions(id),
                    metadata          JSONB DEFAULT '{}'::jsonb,
                    created_at        TIMESTAMPTZ DEFAULT now()
                );

                CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
                CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at ASC);
                CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
                """
            )
            logger.info("Checked/created `conversations` and `messages` tables.")

            # 7. Remove legacy mock workspaces — keep only the production workspace.
            # Reassign any rows pointing at removed workspaces first (FK safety),
            # then delete everything except the canonical workspace.
            cur.execute(
                """
                INSERT INTO workspaces (id, name, code, env, compute, agents, currency, symbol, is_active)
                VALUES ('ws-prd-0982-inr', 'Main Production', 'Node-01', 'Production', 82, 5, 'INR', '₹', true)
                ON CONFLICT (id) DO NOTHING;
                """
            )
            for tbl in ["items", "transactions", "ledger", "pending_actions", "conversations"]:
                cur.execute(
                    f"""
                    UPDATE {tbl}
                    SET workspace_id = 'ws-prd-0982-inr'
                    WHERE workspace_id IS NOT NULL
                      AND workspace_id <> 'ws-prd-0982-inr';
                    """
                )
            cur.execute("DELETE FROM workspaces WHERE id <> 'ws-prd-0982-inr';")
            cur.execute("UPDATE workspaces SET is_active = true WHERE id = 'ws-prd-0982-inr';")
            logger.info("Removed mock workspaces; single production workspace retained.")

    logger.info("Migrations completed successfully ✓")


if __name__ == "__main__":
    run_migrations()

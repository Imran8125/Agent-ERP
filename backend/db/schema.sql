-- Agent-First ERP — Database Schema
-- Phase 1: Local Postgres 16
-- Run: psql -U postgres -d erp -f schema.sql

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- entities: vendors and customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entities (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type       TEXT NOT NULL CHECK (type IN ('vendor', 'customer')),
    name       TEXT NOT NULL,
    email      TEXT,
    phone      TEXT,
    address    TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- items: inventory items / SKUs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku                TEXT UNIQUE NOT NULL,
    name               TEXT NOT NULL,
    description        TEXT,
    unit_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit_price         NUMERIC(12,2) NOT NULL DEFAULT 0,
    quantity_on_hand   INTEGER NOT NULL DEFAULT 0,
    reorder_threshold  INTEGER NOT NULL DEFAULT 0,
    category           TEXT,
    created_at         TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- transactions: purchase orders, sales, stock adjustments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type         TEXT NOT NULL CHECK (type IN ('purchase_order', 'sale', 'stock_adjustment')),
    status       TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'pending_confirmation', 'confirmed', 'ordered', 'received', 'cancelled')),
    entity_id    UUID REFERENCES entities(id),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_by   TEXT NOT NULL,          -- 'user' | agent name
    created_at   TIMESTAMPTZ DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    notes        TEXT
);

-- ---------------------------------------------------------------------------
-- line_items: items within a transaction
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS line_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    item_id        UUID NOT NULL REFERENCES items(id),
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    unit_price     NUMERIC(12,2) NOT NULL
);

-- ---------------------------------------------------------------------------
-- ledger: double-entry accounting ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id),
    entry_type     TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    account        TEXT NOT NULL CHECK (account IN ('cash', 'inventory', 'revenue', 'expense', 'accounts_receivable')),
    amount         NUMERIC(12,2) NOT NULL,
    description    TEXT,
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- pending_actions: confirmation queue (ALL writes go through here)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_actions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,           -- tool name to execute on confirm
    payload     JSONB NOT NULL,
    summary     TEXT NOT NULL,           -- plain-language summary shown to user
    proposed_by TEXT NOT NULL,           -- agent name or 'inbound_email'
    status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'rejected')),
    created_at  TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- audit_log: immutable record of every tool call and confirm/reject
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_action_id UUID REFERENCES pending_actions(id),
    actor             TEXT NOT NULL,     -- 'user' | agent name | 'system'
    action            TEXT NOT NULL,     -- 'proposed' | 'confirmed' | 'rejected' | 'tool_call'
    detail            JSONB,
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes for common query patterns
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_entity ON transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type    ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status  ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_line_items_tx        ON line_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account       ON ledger(account);
CREATE INDEX IF NOT EXISTS idx_ledger_tx            ON ledger(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pending_status       ON pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_audit_created        ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_sku            ON items(sku);
CREATE INDEX IF NOT EXISTS idx_entities_type        ON entities(type);

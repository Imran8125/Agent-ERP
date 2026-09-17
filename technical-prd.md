# Technical PRD — Agent Context Document
## Agent-First ERP (Hackathon Build) — for Google Antigravity

This document is ground truth for coding agents building this project. Schema, contracts, and file layout here are authoritative — treat product rationale/UX framing as covered in the separate product PRD; this doc is implementation-only.

**Stack assumption (change if team already decided otherwise):** Python 3.12 (backend, boto3 for Phase 2), React + Vite (frontend), Postgres. **Phase 1 (now, local):** Postgres running locally, agents call **Gemma 4 E4B via LM Studio's local OpenAI-compatible API** (`http://localhost:1234/v1`), tool functions run as plain Python functions behind a local FastAPI server (no Lambda/API Gateway yet). **Phase 2 (Saturday, AWS credits available):** swap model backend to Amazon Bedrock (Claude), move DB to Aurora Serverless v2, wrap tool functions as Lambda handlers behind API Gateway. A single `model_client.py` abstraction (see §4.0) makes the model swap a config change, not a code change.

---

## 1. Repository Structure

```
/backend
/frontend
/tests
docker-compose.yml
```

Full layout:

```
/backend
  /agents
    master_agent.py
    procurement_agent.py
    inventory_agent.py
    finance_agent.py
    crm_agent.py
    reporting_agent.py
    routing.py              # intent -> agent mapping
    model_client.py          # model-agnostic chat+tools client (LM Studio / Bedrock)
  /tools                     # one Lambda handler per typed operation
    create_purchase_order.py
    receive_stock.py
    get_low_stock.py
    get_stock.py
    log_sale.py
    add_customer.py
    get_customer_history.py
    get_cash_position.py
    get_expense_summary.py
    run_report.py            # sales_trend | top_customers | inventory_value
    adjust_stock.py
    send_email.py
    parse_inbound_email.py
  /db
    schema.sql
    models.py                 # ORM / typed row models
    seed_data.sql
  /confirmation
    pending_action.py         # create/list/confirm/reject
  /common
    validation.py
    errors.py
    aws_clients.py            # env-driven endpoint (Floci vs real AWS)
  /infra
    template.yaml              # SAM/CDK — Lambda, API GW, Aurora, SES, Cognito (Phase 2)
    aws.env
  local_server.py              # Phase 1 only — FastAPI wrapper exposing the same tool functions directly, no Lambda/API GW
/frontend
  /src
    ChatPanel.tsx
    InventoryTable.tsx
    ReportCharts.tsx
    ConfirmationCard.tsx
    api.ts
/tests
  test_tools.py
  test_agents.py
```

---

## 2. Data Model — `schema.sql`

```sql
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('vendor', 'customer')),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    reorder_threshold INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('purchase_order', 'sale', 'stock_adjustment')),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_confirmation', 'confirmed', 'ordered', 'received', 'cancelled')),
    entity_id UUID REFERENCES entities(id),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,          -- 'user' | agent name
    created_at TIMESTAMPTZ DEFAULT now(),
    confirmed_at TIMESTAMPTZ
);

CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    item_id UUID NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL
);

CREATE TABLE ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
    account TEXT NOT NULL,             -- 'cash' | 'inventory' | 'revenue' | 'expense'
    amount NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pending_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,          -- tool name to execute on confirm
    payload JSONB NOT NULL,
    summary TEXT NOT NULL,              -- plain-language summary shown to user
    proposed_by TEXT NOT NULL,          -- agent name or 'inbound_email'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pending_action_id UUID REFERENCES pending_actions(id),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    detail JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. Tool Contracts

Every tool: pure function, validates input, returns structured result, never raises uncaught exceptions to the agent layer (see `/common/errors.py` — return `{"ok": False, "error": "..."}` instead).

State-changing tools do NOT write to `transactions`/`ledger`/`items` directly — they write to `pending_actions` with `status='pending'`. Only `confirm_pending_action(id)` (in `/confirmation/pending_action.py`) performs the real write, inside a DB transaction.

```python
# tools/create_purchase_order.py
def create_purchase_order(
    vendor_id: str,
    items: list[dict],   # [{"item_id": str, "quantity": int, "unit_cost": float}]
) -> dict:
    """
    Validates: vendor exists (type='vendor'), each item exists, quantity > 0.
    Computes total_amount.
    Writes a pending_actions row (action_type='create_purchase_order').
    Returns: {"ok": True, "pending_action_id": str, "summary": str, "total_amount": float}
             | {"ok": False, "error": str}
    """

# tools/receive_stock.py
def receive_stock(transaction_id: str) -> dict:
    """
    Validates: transaction exists, type='purchase_order', status='ordered'.
    Proposes: status -> 'received', items.quantity_on_hand += line_items.quantity,
              ledger entries (debit inventory, credit cash) — via pending_actions.
    Returns: {"ok": True, "pending_action_id": str, "summary": str} | {"ok": False, "error": str}
    """

# tools/get_low_stock.py
def get_low_stock() -> dict:
    """
    Read-only. No confirmation needed.
    Returns: {"ok": True, "items": [{"item_id", "name", "quantity_on_hand", "reorder_threshold"}]}
    """

# tools/get_stock.py
def get_stock(item_name: str | None = None) -> dict:
    """ Read-only. Fuzzy-matches item_name if provided, else returns all items. """

# tools/log_sale.py
def log_sale(customer_id: str, items: list[dict]) -> dict:
    """
    Validates: customer exists (type='customer'), sufficient quantity_on_hand for each item.
    Proposes: transaction(type='sale'), line_items, ledger (debit cash, credit revenue),
              items.quantity_on_hand -= quantity — via pending_actions.
    """

# tools/add_customer.py
def add_customer(name: str, email: str | None = None, phone: str | None = None) -> dict:
    """ Low-risk write — may auto-execute without confirmation (see 4.3). """

# tools/get_customer_history.py
def get_customer_history(customer_id: str) -> dict:
    """ Read-only. Returns transactions + line_items for the customer. """

# tools/get_cash_position.py
def get_cash_position() -> dict:
    """ Read-only. Sums ledger 'cash' account debits/credits. """

# tools/get_expense_summary.py
def get_expense_summary(period_days: int = 30) -> dict:
    """ Read-only. Groups ledger 'expense' entries by vendor over the period. """

# tools/run_report.py
def run_report(report_type: str) -> dict:
    """
    report_type in {"sales_trend", "top_customers", "inventory_value"}.
    Read-only. Returns chart-ready data: {"labels": [...], "values": [...]}.
    """

# tools/adjust_stock.py
def adjust_stock(item_id: str, delta: int, reason: str) -> dict:
    """ Proposes items.quantity_on_hand += delta + ledger entry — via pending_actions. """

# tools/send_email.py
def send_email(to: str, subject: str, body: str, related_transaction_id: str | None = None) -> dict:
    """
    Sends via SES. NOTIFICATION ONLY — for actions already confirmed (e.g. PO already
    placed, low-stock alert). Does not itself require confirmation. Logs to audit_log.
    """

# tools/parse_inbound_email.py
def parse_inbound_email(raw_email_s3_key: str) -> dict:
    """
    Triggered by SES receiving -> S3 -> Lambda.
    Uses Bedrock to extract intent (e.g. "vendor confirmed shipment for PO #123").
    Writes a pending_actions row with proposed_by='inbound_email' and the matching
    tool payload (e.g. receive_stock). Does NOT execute — goes through normal confirmation.
    """
```

---

## 4. Agent Behavior Specs

### 4.0 Model Client Abstraction (`agents/model_client.py`)

Single interface every agent calls — never call LM Studio or Bedrock SDKs directly from agent code.

```python
def chat_with_tools(
    system_prompt: str,
    messages: list[dict],       # [{"role": "user"|"assistant"|"tool", "content": ...}]
    tools: list[dict],          # OpenAI-style tool schemas (name, description, parameters)
) -> dict:
    """
    Dispatches to LM Studio or Bedrock based on MODEL_BACKEND env var.
    Returns a normalized shape regardless of backend:
    {"content": str | None, "tool_calls": [{"name": str, "arguments": dict}]}
    """
```

- `MODEL_BACKEND=lmstudio` → POST to `LM_STUDIO_BASE_URL/chat/completions` (OpenAI-compatible), model name e.g. `gemma-4-e4b-it`, parse `tool_calls` from the response.
- `MODEL_BACKEND=bedrock` → `bedrock-runtime` `converse` API with `anthropic.claude-*` model ID and the same `tools` schema, mapped to Bedrock's tool-use format.
- Tool schemas (name/description/parameters) are defined once per tool (see §3) and passed through unchanged to whichever backend is active — this is what makes the Saturday swap config-only.
- Log every raw model response to `audit_log.detail` regardless of backend — useful for debugging tool-call parsing differences between Gemma and Claude.

## 4.1 Master Agent (`agents/master_agent.py`)
- Input: user message (+ optional `@tag`).
- If `@tag` present → route directly to that specialist, skip planning step.
- Else → classify intent, call 1+ specialist(s), assemble final natural-language response.
- Never calls tools directly — always delegates to a specialist agent.

### 4.2 Specialist Agents
Each specialist is a Bedrock-backed agent bound to a fixed tool subset:
| Agent | Tools |
|---|---|
| Procurement | create_purchase_order, receive_stock, send_email |
| Inventory | get_stock, get_low_stock, adjust_stock |
| Finance | get_cash_position, get_expense_summary |
| CRM | add_customer, get_customer_history, log_sale |
| Reporting | run_report |

Proactive behavior (Inventory agent): a scheduled Lambda (EventBridge rate rule, e.g. every 5 min in demo) calls `get_low_stock`; if results non-empty, it pushes a message into the chat session as if the agent spoke first, offering to draft a PO.

### 4.3 Confirmation Policy
- **Requires confirmation:** any tool that mutates `items`, `transactions`, `ledger` (create_purchase_order, receive_stock, log_sale, adjust_stock).
- **Auto-executes (no confirmation):** read-only tools (get_*, run_report), `send_email` (already-confirmed notification), `add_customer` (reversible, low-risk — flag if team disagrees).
- Confirmation UI: `ConfirmationCard.tsx` renders `pending_actions.summary` with Confirm/Reject buttons → calls `POST /pending-actions/{id}/confirm` or `/reject`.

---

## 5. Confirmation Layer Contract

```python
# confirmation/pending_action.py
def confirm_pending_action(pending_action_id: str) -> dict:
    """
    Loads pending_actions row. Dispatches to the real write logic for action_type,
    inside a single DB transaction. On success: pending_actions.status='confirmed',
    writes audit_log row. Returns {"ok": True, "result": {...}}.
    """

def reject_pending_action(pending_action_id: str, reason: str | None = None) -> dict:
    """ Sets status='rejected', writes audit_log row. No DB side effects elsewhere. """
```

---

## 6. Environment / Config

### Phase 1 — Local (now)

No Docker, no AWS emulation. Postgres installed locally, tool functions run behind a local FastAPI server (`local_server.py`), agents call Gemma 4 E4B through **LM Studio's local server** (Developer tab → Start Server, OpenAI-compatible API on port 1234 by default).

```
# .env.local
MODEL_BACKEND=lmstudio
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=gemma-4-e4b-it
DB_HOST=localhost
DB_PORT=5432
DB_NAME=erp
DB_USER=postgres
DB_PASSWORD=devpassword
```

Run: `local_server.py` starts FastAPI, exposes each tool as a plain HTTP endpoint (`/tools/create_purchase_order`, etc.) for the frontend/agents to call directly — same function bodies that later become Lambda handlers, just invoked without AWS in between.

### Phase 2 — AWS (from Saturday, once credits land)

```
# .env.aws
MODEL_BACKEND=bedrock
BEDROCK_MODEL_ID=anthropic.claude-<model-id>   # confirm exact ID available at deploy time
AWS_DEFAULT_REGION=us-east-1
DB_HOST=<aurora-endpoint>
DB_PORT=5432
```

Migration checklist for the swap:
1. Deploy `infra/template.yaml` (Aurora, Lambda, API Gateway, SES, Cognito).
2. Point `model_client.py` at Bedrock (`MODEL_BACKEND=bedrock`) — no tool-call code changes needed, only re-validate tool-call accuracy (Gemma vs. Claude can differ — see product PRD risks).
3. Migrate schema + seed data from local Postgres to Aurora (`pg_dump` / `pg_restore`).
4. Re-run the core Procurement→Inventory demo flow end-to-end against real AWS before recording the video — the hackathon rules require AWS visibly in use on video, not just named.

`common/aws_clients.py` (used only in Phase 2) reads `AWS_ENDPOINT_URL` if set, for optional local-AWS-emulator testing (e.g. Floci) before a full deploy — otherwise defaults to real AWS.

---

## 7. Non-Functional Requirements

- All tool functions: full type hints, docstring matching the contract above.
- No tool call may throw — catch and return `{"ok": False, "error": str}`.
- Every write path goes through `pending_actions` — no direct writes from agent code, even for "low risk" tools (keeps one code path to reason about/demo).
- Idempotency: `confirm_pending_action` must no-op safely if called twice (check `status` before writing).
- Logging: every tool call and every confirm/reject writes to `audit_log`.

---

## 8. Task Breakdown (maps to 4-day plan, assign per agent/owner)

| # | Task | Depends on |
|---|---|---|
| 1 | `schema.sql` + seed data, local Postgres setup | — |
| 2 | `model_client.py` (LM Studio backend) + `.env.local` | — |
| 3 | Read-only tools (get_stock, get_low_stock, get_cash_position, get_customer_history, run_report) | 1 |
| 4 | Write tools + pending_actions (create_purchase_order, receive_stock, log_sale, adjust_stock, add_customer) | 1 |
| 5 | `confirmation/pending_action.py` (confirm/reject) | 4 |
| 6 | Master + specialist agents, wired to `model_client.py` (LM Studio/Gemma 4 E4B) | 2, 3, 4 |
| 7 | `local_server.py` (FastAPI exposing tools) | 3, 4 |
| 8 | Proactive low-stock trigger (local: simple polling loop; Phase 2: EventBridge) | 3, 6 |
| 9 | Frontend: ChatPanel, InventoryTable, ConfirmationCard | 6, 7 |
| 10 | Frontend: ReportCharts | 3, 9 |
| — | **Saturday: AWS credits land** | |
| 11 | Deploy `infra/template.yaml` (Aurora, Lambda, API GW, SES, Cognito) | all above |
| 12 | Swap `model_client.py` to `MODEL_BACKEND=bedrock`, re-validate tool-call accuracy | 11 |
| 13 | Migrate schema/data to Aurora; wrap tools as Lambda handlers | 11 |
| 14 | send_email (SES outbound) | 13 |
| 15 | parse_inbound_email (SES receive → S3 → Lambda → Bedrock parse → pending_actions) | 12, 13 |
| 16 | Full run-through + deploy validation, then record demo video against real AWS | 12, 13, 14, 15 |

---

## 9. Coding Conventions

- Python: `black` formatting, type hints required on all public functions, no bare `except`.
- Commit early/often — repo history must plausibly match the hackathon's stated build window (rules require this).
- Every tool function gets a matching test in `/tests/test_tools.py` using Floci.

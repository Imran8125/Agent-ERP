# Design.md — UI/UX Specification
## Agent-First ERP (Hackathon Build)

---

## 1. Design Principles

1. **Zero-training operation.** Every screen must be usable by someone who has never seen ERP software. No jargon (no "GL," "SKU-level allocation," "reconciliation") — use plain words ("stock," "order," "money in/out").
2. **Conversation is the primary interface.** The chat panel is never hidden or secondary — every other view exists to *support* what's happening in chat, not replace it.
3. **State changes must be seen, not just told.** Whenever an agent acts, the affected table/number visibly updates in the same view — this is the core proof of "agent-first," and it must be visually unmissable (brief highlight/flash on the changed row).
4. **Nothing commits silently.** Any action that changes data always passes through a visible Confirmation Card before it happens. No exceptions in the UI, even for actions the backend auto-executes.
5. **One screen, not five.** Resist multi-page navigation — this is a single-view app (chat + live side panel), matching the "no menus to learn" premise.

---

## 2. Information Architecture

Single-page layout, two zones, no navigation menu:

```
┌─────────────────────────────┬───────────────────────────┐
│                               │                            │
│         CHAT PANEL           │        CONTEXT PANEL       │
│    (primary, ~55% width)     │      (secondary, ~45%)     │
│                               │                            │
│  - message history           │  Tabs (not nav — just      │
│  - agent responses            │  visibility toggles):      │
│  - confirmation cards         │   [Inventory] [Reports]    │
│  - inline charts              │   [Activity Log]           │
│                               │                            │
└─────────────────────────────┴───────────────────────────┘
```

On mobile / narrow viewport: stack vertically, Context Panel collapses to a swipeable drawer below the chat.

---

## 3. Core Screens / Views

### 3.1 Chat Panel (primary)
- Standard chat bubble layout: user messages right-aligned, agent messages left-aligned.
- Agent messages are attributed with a small label + icon per agent (Master / Procurement / Inventory / Finance / CRM / Reporting) so the multi-agent story is visible without the user needing to understand routing.
- `@tag` autocomplete: typing `@` shows a small popover listing the 5 specialists.
- Proactive agent messages (e.g., low-stock alert) are visually distinguished with a subtle left-border accent + "noticed this" icon, so the user can tell the agent spoke unprompted vs. responded to them.

### 3.2 Confirmation Card (inline, within chat)
The single most important component — every write action renders one of these instead of plain text.

```
┌───────────────────────────────────────────┐
│ 🛒 Procurement Agent proposes:             │
│                                             │
│ Order 200 pencils from Acme Supplies       │
│ Total: ₹4,000 · Expected in 3 days         │
│                                             │
│   [ ✅ Confirm ]      [ ✖ Reject ]          │
└───────────────────────────────────────────┘
```
- Plain-language summary only — never show raw JSON/IDs.
- After a decision, card collapses to a one-line receipt ("✅ Confirmed — PO #123 placed") so history stays scannable.
- Rejected actions show the reason field if the user typed one, else just "Rejected."

### 3.3 Inventory Table (Context Panel, default tab)
- Columns: Item, Quantity on hand, Reorder threshold, Status (badge: "OK" green / "Low" amber / "Out" red).
- Row that just changed briefly highlights (1–2s background flash) when a confirmed action updates it — this is the "state changes are visible" proof point in the demo video.
- Low-stock rows sort to top.

### 3.4 Reports Tab
- 3 fixed charts, agent-generated but rendered with a standard charting lib for visual polish: Sales trend (line), Top customers (bar), Inventory value (bar or single stat + breakdown).
- Each chart has a 1-line caption in plain language (e.g., "Sales have grown steadily over the last 2 weeks") — avoid raw axis-only charts with no takeaway.

### 3.5 Activity Log Tab
- Reverse-chronological list of confirmed/rejected actions: who/what agent proposed it, when, outcome.
- This is the audit trail made visible — supports the "trust" design principle and is a good secondary demo beat if time allows.

---

## 4. Interaction Patterns

| Pattern | Behavior |
|---|---|
| Sending a message | Enter to send; Shift+Enter for newline. Agent response streams in (token-by-token) rather than appearing all at once — reinforces "live agent," not "canned response." |
| Tagging a specialist | `@inventory how many pencils` routes directly, skips Master Agent's routing step, response still appears in the same chat thread. |
| Confirming an action | Click Confirm → card shows a brief loading state (~"Placing order...") → collapses to receipt → Inventory Table updates with highlight, in that order, so cause → effect is visually traceable. |
| Proactive alert | Appears in chat as if the agent initiated — no user action required to trigger it; on screen load in a demo, this should already be visible from a pre-seeded low-stock item. |
| Empty states | New chat: a short suggested-prompts list ("Try: 'how much stock do we have?'") rather than a blank screen — critical for the "zero training" principle. |

---

## 5. Visual Style

- **Tone:** calm, plain, business-tool-neutral — not playful/childish despite the "10-year-old" usability bar (that's about ease, not visual infantilization).
- **Color roles:**
  - Primary accent (agent messages, buttons): one confident brand color.
  - Status: green (OK/confirmed), amber (low stock/pending), red (out of stock/rejected). Never rely on color alone — pair with text/icon for the status badges.
  - Neutral grays for chat background/bubbles.
- **Typography:** one clean sans-serif, 2 weights max (regular/semibold). Body text large enough to read comfortably at a glance during a recorded demo (16px+ base).
- **Density:** generous spacing over compact tables — this is a legibility/demo-clarity choice as much as a usability one.
- **Icons:** simple line icons per agent (cart=Procurement, box=Inventory, coin=Finance, person=CRM, chart=Reporting) — reinforces which agent is speaking faster than reading the label.

---

## 6. Accessibility & Clarity Baseline

- All confirmation actions reachable via keyboard (Tab + Enter), not just mouse click.
- Color-coded statuses always paired with text/icon, not color alone.
- No unexplained abbreviations anywhere in the UI copy — this is a direct extension of Design Principle 1 and should be treated as a hard rule when writing any UI string.

---

## 7. Demo-Specific UI Notes

Since judging is entirely video-based (no live demo), a few UI choices exist specifically to make the *recording* read clearly:
- State-change highlight flash should be slow enough (~1.5s) to be clearly visible on video, not just a fast flicker.
- Agent attribution labels/icons should be large enough to read at normal video zoom — don't rely on hover tooltips for identity.
- Keep the Context Panel on the Inventory tab by default during the core demo sequence so the live-update payoff is always on-screen without a tab switch.

---
name: Agentic Precision ERP
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464554'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777586'
  outline-variant: '#c7c4d7'
  surface-tint: '#5148d7'
  primary: '#2a14b4'
  on-primary: '#ffffff'
  primary-container: '#4338ca'
  on-primary-container: '#c1beff'
  inverse-primary: '#c3c0ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#692400'
  on-tertiary: '#ffffff'
  tertiary-container: '#8f3400'
  on-tertiary-container: '#ffb393'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#100069'
  on-primary-fixed-variant: '#372abf'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb597'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  color-bg: '#F8FAFC'
  color-surface: '#FFFFFF'
  color-surface-elevated: '#FFFFFF'
  color-surface-subtle: '#F1F5F9'
  color-border: '#E2E8F0'
  color-border-subtle: '#EDF2F7'
  color-text-primary: '#0F172A'
  color-text-secondary: '#475569'
  color-text-muted: '#94A3B8'
  color-accent: '#4338CA'
  color-accent-hover: '#3730A3'
  color-accent-subtle: '#EEF2FF'
  color-success: '#059669'
  color-success-bg: '#ECFDF5'
  color-success-border: '#A7F3D0'
  color-warning: '#D97706'
  color-warning-bg: '#FFFBEB'
  color-warning-border: '#FDE68A'
  color-error: '#DC2626'
  color-error-bg: '#FEF2F2'
  color-error-border: '#FECACA'
  color-info: '#2563EB'
  color-info-bg: '#EFF6FF'
  color-info-border: '#BFDBFE'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.01em
  data-mono-bold:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
---

# Design Specification — Agent-First ERP

> **Design Read**: Autonomous AI-First ERP for modern business operators and fast-moving teams, with a calm, high-precision, minimal B2B language, leaning toward Linear-meets-Reflect operational ergonomics, tabular integrity, and Emil Kowalski-grade interaction physics.
>
> **Mode**: `Operate` (Speed, scanability, visual certainty of state mutations, zero-training clarity, keyboard-first flow).
>
> **Three Dials**:
> - `DESIGN_VARIANCE: 5` — High structural discipline, predictable layouts, zero arbitrary asymmetry.
> - `MOTION_INTENSITY: 4` — Functional, responsive (<200ms), hardware-accelerated, zero gratuitous animation.
> - `VISUAL_DENSITY: 7` — Dense operational clarity, tabular numerals, 1px structural hairlines, zero card slop.

---

## 1. Executive Principles

1. **Zero-Training Usability (Plain Language First)**
   - Every interface string must be instantly clear to an operator with zero prior ERP training.
   - Banned jargon: "GL", "SKU-level allocation", "reconciliation", "amortization schedules".
   - Required terms: "stock on hand", "order items", "cash in/out", "customer purchase".
2. **Conversation is the Primary Cockpit**
   - The AI conversation stream is never secondary or tucked into a floating drawer.
   - It is the central command center (~55% desktop width) where natural language queries become structured database queries and proposals.
3. **State Changes Must Be Seen, Not Just Told**
   - Whenever an agent mutates data (e.g., placing a PO or logging a sale), the affected telemetry row flashes with a smooth 1.2s soft emerald highlight (`#ECFDF5` fading to `#FFFFFF`).
   - The user never wonders if the command actually executed. Cause and effect are visually immediate.
4. **Nothing Commits Silently (The Trust Gateway)**
   - Any state-changing operation (inventory updates, purchase orders, ledger entries) MUST pass through an explicit inline `ConfirmationCard`.
   - Read operations execute automatically; write operations require a deliberate human click or keyboard confirmation (`Enter`).
5. **Structural Restraint (Anti-Slop Discipline)**
   - No generic SaaS card soup. No heavy drop-shadows, no AI purple glows, and no nested containers.
   - Layout groups are formed with clean 1px hairline dividers (`#E2E8F0`), subtle background shifts, and whitespace.
   - Strict eyebrow restraint: maximum 1 uppercase tracking eyebrow per 3 view modules.

---

## 2. Workspace Shell & Information Architecture

The system operates as a unified single-screen command center with two synchronized operational zones:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Klaro ERP]  ● 5 Agents Active      [ Ask anything... (⌘K) ]       Session: Main Ledger│
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│                                          │                                             │
│       ZONE 1: AUTONOMOUS AI WORKSPACE     │          ZONE 2: LIVE CONTEXT PANEL         │
│          (Primary Cockpit, 55% Width)    │       (Telemetry & Supporting Data, 45%)    │
│                                          │                                             │
│  - Multi-Agent Conversational Stream     │  Tabs:                                      │
│  - Specialist Agent Attribution Tags     │  [ Stock & Inventory ]  [ Analytics ]  [ Log]│
│  - Inline Proposal & Confirmation Cards  │ ─────────────────────────────────────────── │
│  - Streaming Token Feedback              │  Live Telemetry Table                       │
│  - Suggested Prompt Starters             │  - Real-time stock counts & thresholds      │
│                                          │  - 1.2s visual flash on row mutation        │
│  ┌────────────────────────────────────┐  │  - Low-stock visual warning badges          │
│  │ Ask anything or @tag a specialist  │  │  - Instant search & reorder filters         │
│  └────────────────────────────────────┘  │                                             │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

### 2.1 Viewport Mechanics & Responsiveness
- **Desktop (≥ 1024px)**: Synchronized side-by-side 55% / 45% split. Height locked to `min-h-[100dvh]` to prevent vertical viewport jumping.
- **Tablet (768px – 1023px)**: 60% / 40% split with compact table columns; navigation switches to icon badges.
- **Mobile (< 768px)**: Single-column vertical stack. Zone 1 (AI Workspace) occupies full width; Zone 2 (Context Telemetry) collapses into a bottom-anchored swipeable drawer with a sticky badge showing active pending counts.

---

## 3. Component Design System

### 3.1 ChatPanel & Agent Attribution
The conversational engine renders human and multi-agent interactions with crisp typography and subtle attribution:

- **User Messages**: Right-aligned, minimal container (`#F1F5F9` subtle slate surface, `#0F172A` text), maximum line length `65ch`.
- **Agent Messages**: Left-aligned, transparent container resting directly on the canvas with a 1px border.
- **Agent Identity Badges**:
  - `Master Agent`: `#0F172A` Slate badge with central router icon.
  - `Procurement Agent`: `#4338CA` Indigo badge with shopping cart glyph.
  - `Inventory Agent`: `#0284C7` Sky badge with storage box glyph.
  - `Finance Agent`: `#059669` Emerald badge with ledger balance glyph.
  - `CRM Agent`: `#7C3AED` Violet badge with user contact glyph.
  - `Reporting Agent`: `#D97706` Amber badge with analytical chart glyph.
- **`@tag` Specialist Autocomplete**:
  - Typing `@` triggers an origin-aware popover (`transform-origin: bottom left`).
  - Lists the 5 specialists with real-time routing descriptions.
  - Full keyboard navigation: `ArrowDown`, `ArrowUp`, `Enter` to select, `Esc` to dismiss.
- **Proactive Alerts**:
  - When the Inventory Agent notices stock below reorder thresholds, it injects a proactive alert message.
  - Styled with a 2px left border (`#D97706`) and an action prompt: *"3 items are critically low on stock. Would you like me to draft a purchase order?"*

### 3.2 ConfirmationCard (The Core Trust Component)
The `ConfirmationCard` is the most critical trust mechanism in the ERP. Any proposed mutation to database state renders this card inline.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🛒 Procurement Agent proposes:                                          │
│                                                                        │
│ Order 200 Industrial Filters from Acme Supplies                        │
│ ────────────────────────────────────────────────────────────────────── │
│ Item                 Quantity       Unit Cost            Total         │
│ Industrial Filter         200           ₹20.00          ₹4,000         │
│ Valve Assembly             15           ₹80.00          ₹1,200         │
│ ────────────────────────────────────────────────────────────────────── │
│ Total PO Amount: ₹5,200 · Delivery Expected in 3 Business Days         │
│                                                                        │
│   [ ✖ Decline Proposal ]                [ ✅ Confirm & Place Order ]    │
└────────────────────────────────────────────────────────────────────────┘
```

#### Lifecycle & State Machine:
1. **Pending Review**:
   - Card displays itemized rows, clean hairline separators, and transparent arithmetic.
   - Primary button: `[ Confirm & Place Order ]` (`#4338CA` solid indigo fill, `#FFFFFF` text, `4px` radius).
   - Secondary button: `[ Decline Proposal ]` (transparent background, `#E2E8F0` border, `#475569` text).
2. **In-Flight Loading**:
   - Upon clicking Confirm, button transitions into a non-interactive loading state (140ms ease-out) displaying a fast-spinning ring and text: *"Posting to ledger & placing PO..."*
   - Duplicate submissions are physically disabled.
3. **Confirmed Receipt State**:
   - Card collapses cleanly (height transition: 180ms ease-out) into a permanent 38px audit receipt:
     `✅ Confirmed — PO #1042 placed · Total ₹5,200 posted to Accounts Payable`
   - Clutter is eliminated; chat history remains effortlessly scannable.
4. **Declined State**:
   - Collapses into a neutral receipt:
     `✖ Declined — Proposal dismissed by operator`

### 3.3 Inventory Telemetry Hub (Context Panel Tab 1)
- **Header**: Tabular summary showing Total Items, Low-Stock Count, and Total Inventory Valuation.
- **Table Structure**:
  - `Item Name`: High-contrast title (`#0F172A`, 14px font).
  - `SKU`: Monospace badge (`JetBrains Mono`, 12px, `#475569`).
  - `On Hand`: Tabular numeral (`font-feature-settings: "tnum"`).
  - `Reorder Threshold`: Muted comparison metric.
  - `Status`:
    - `In Stock`: `#ECFDF5` background, `#059669` text, `●` icon.
    - `Low Stock`: `#FFFBEB` background, `#D97706` text, `▲` icon.
    - `Out of Stock`: `#FEF2F2` background, `#DC2626` text, `■` icon.
- **State Mutation Highlight**:
  - When a confirmed action increments or decrements quantity, that specific row receives the CSS animation:
    `animation: flashHighlight 1.2s cubic-bezier(0.23, 1, 0.32, 1) forwards;`
  - Instantly links the chat confirmation to physical data changes.

### 3.4 Business Analytics & Reports (Context Panel Tab 2)
- Replaces complex BI dashboards with three focused, readable charts:
  1. **Sales Trend**: 14-day revenue progression (monochrome slate stroke with subtle indigo data points).
  2. **Top Customers**: Horizontal bar chart sorted by transactional volume.
  3. **Inventory Valuation**: Category asset breakdown.
- **Required Caption Rule**: Every chart MUST render an inline, 1-sentence plain English takeaway caption directly beneath the visualization (e.g., *"Revenue increased 14.2% week-over-week driven primarily by Acme Supplies replenishment."*).

### 3.5 Activity & Audit Log (Context Panel Tab 3)
- An immutable, reverse-chronological record of every tool execution, confirmation, and decline.
- Visual timeline with micro-stamps (`10:42:15 AM`), actor tag (`Operator` vs `Agent Name`), and inspectable JSON payload drawer for compliance.

---

## 4. Emil Kowalski Interaction Physics & Animation Specs

Interfaces feel premium when motion is purposeful, predictable, and physically grounded.

### 4.1 The Animation Decision Framework

| Interaction | Frequency | Animation Behavior | Exact Curve / Timing |
|---|---|---|---|
| **Keyboard Command (`⌘K`, `@`)** | 100+ / day | **Zero animation (0ms)** | Instant appearance; never delay keyboard actions |
| **Button Press (`Confirm / Reject`)** | Tens / day | **Tactile Scale Down** | `transform: scale(0.98)` on `:active`, 140ms `ease-out` |
| **Receipt Card Collapse** | Occasional | **Height & Opacity Blend** | `max-height 200ms ease-out`, `opacity 150ms ease-in` |
| **Telemetry Row Flash** | On Mutation | **1.2s Dissolving Tint** | `@keyframes flashHighlight 1.2s cubic-bezier(0.23, 1, 0.32, 1)` |
| **Autocomplete Popover** | On `@` key | **Origin-Aware Scale** | From `scale(0.96); opacity: 0` to `scale(1); opacity: 1` in 120ms |
| **Toast / Quick Feedback** | Occasional | **Origin Slide + Fade** | `transform: translateY(0); opacity: 1` (160ms ease-out) |

### 4.2 Core Animation Tokens (CSS)
```css
:root {
  /* Emil Kowalski custom curves */
  --ease-snappy: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-exit: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-bounce-subtle: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Durations */
  --duration-tactile: 140ms;
  --duration-popover: 180ms;
  --duration-flash: 1200ms;
}

/* Button tactile feedback */
.button-tactile {
  transition: transform var(--duration-tactile) var(--ease-snappy),
              background-color var(--duration-tactile) ease;
}
.button-tactile:active {
  transform: scale(0.98);
}

/* Row state change flash */
@keyframes flashHighlight {
  0% {
    background-color: #ECFDF5;
    box-shadow: inset 0 0 0 1px #A7F3D0;
  }
  100% {
    background-color: transparent;
    box-shadow: inset 0 0 0 1px transparent;
  }
}

/* Tabular numbers lock to prevent layout jitter */
.tabular-data {
  font-family: 'JetBrains Mono', monospace;
  font-feature-settings: "tnum" 1;
  font-variant-numeric: tabular-nums;
}
```

### 4.3 Component Polish: Before & After Table

| Before | After | Why |
|---|---|---|
| `transition: all 300ms` | `transition: transform 140ms ease-out` | `all` degrades GPU performance; specific properties ensure 60fps |
| Popover scales from center | `transform-origin: var(--transform-origin)` | Popovers must scale outwards from the `@` trigger position |
| Animated modal on `Esc` key | Instant dismissal (0ms) | Keyboard interactions must never wait on transition frames |
| Dialog enters from `scale(0)` | Enters from `scale(0.96)` with opacity fade | Physical objects never appear from zero dimensions |
| Plain text PO confirmation | Collapsing confirmation card with permanent receipt | Prevents duplicate clicks, provides transparent audit trail |
| Numbers jump width when updating | Monospace tabular numerals (`tnum`) | Eliminates distracting horizontal layout jitter during updates |

---

## 5. Color Palette & Accessibility Guardrails

### 5.1 Palette Calibration
- **Canvas Base**: `#F8FAFC` (Slate 50) — ultra-clean, glare-free background.
- **Surface Panels**: `#FFFFFF` (Pure White) — flat, delimited by 1px solid `#E2E8F0` borders.
- **Primary Action Accent**: `#4338CA` (Enterprise Indigo) — authoritative, non-neon, WCAG AAA compliant against white (contrast ratio 7.8:1).
- **Primary Typography**: `#0F172A` (Slate 900) — high-contrast reading clarity.
- **Secondary Typography**: `#475569` (Slate 600) — legible metadata.
- **Status Indicators**:
  - Success: `#059669` (Emerald) on `#ECFDF5` with `#A7F3D0` border.
  - Warning: `#D97706` (Amber) on `#FFFBEB` with `#FDE68A` border.
  - Danger: `#DC2626` (Red) on `#FEF2F2` with `#FECACA` border.

### 5.2 Accessibility Standard
- **No Color-Alone States**: Every status indicator combines color with an icon (`●`, `▲`, `■`) and clear textual label.
- **Full Keyboard Operability**:
  - `Tab` navigates through inputs and cards.
  - `Enter` confirms pending actions.
  - `Esc` cancels modals or dismisses the `@` autocomplete popover.
  - `⌘K` focuses global agent search.
- **Reduced Motion Support**:
  - Under `@media (prefers-reduced-motion: reduce)`, all transforms collapse to instant transitions or gentle opacity fades.

---

## 6. Stitch MCP Screen Architecture & Synchronization

This design specification is synced with **Stitch MCP** to generate and manage high-fidelity UI artifacts.

### 6.1 Stitch Project & Design System Metadata
- **Project Name**: `projects/17328437596101952750`
- **Project Title**: `Agent ERP - Professional Minimal UI`
- **Design System Asset**: `assets/3848d950d91e4190a1857d814d07fad3` (`Agentic Precision ERP`)
- **Device Target**: `DESKTOP` (2560px × 1440px / 2048px responsive viewport)
- **Local Screen Artifact**: [code.html](file:///Users/imran/Code/Agent-ERP/UI%20Designs/autonomous_ai_workspace_telemetry_cockpit/code.html) | [screen.png](file:///Users/imran/Code/Agent-ERP/UI%20Designs/autonomous_ai_workspace_telemetry_cockpit/screen.png)

### 6.2 Key UI Screens Generated in Stitch
1. **Autonomous AI Workspace & Telemetry Cockpit** (Screen ID: `14b94e826ce84e89a669d4ca8deee356`)
   - 55% Chat Cockpit with live multi-agent dialogue (Procurement Agent, Inventory Agent), inline `ConfirmationCard` with itemized PO table and `[ ✅ Confirm & Place Order ]` / `[ ✖ Decline Proposal ]` controls.
   - 45% Live Telemetry Panel showing active **Stock & Inventory** table with real-time `Industrial Filter` row emerald highlight flash indicator (`#ECFDF5`).
   - Sticky 60px header with Klaro ERP brand logo, `● 5 Agents Active` status indicator, and `⌘K` global search accelerator.
2. **Inventory & Telemetry Hub View**
   - High-density tabular view with low-stock badges, reorder point thresholds, and stock intake filters.
3. **Finance & Double-Entry Ledger View**
   - Real-time cash position summary, recent debits/credits, and audit-ready ledger table.
4. **CRM & Customer Transaction View**
   - Customer transaction history, purchase trends, and verified contact cards.
5. **Executive Reports & BI Analytics View**
   - Clean minimalist charts with 1-sentence analytical takeaway captions.
6. **Activity & Audit Log View**
   - Chronological audit stream with expandable payload inspector drawers.

---

## 7. Anti-Slop & Pre-Flight Verification Checklist

Before deploying or implementing any UI component, verify against this strict pre-flight audit:

- [x] **No AI-Purple Glows**: No purple button glows, gradients, or ambient neon blobs.
- [x] **No Unnecessary Cards**: Tables and lists breathe within structural hairline borders (`#E2E8F0`), not stacked elevated cards.
- [x] **Single Accent Lock**: Exactly one primary accent (`#4338CA`) used consistently across all modules.
- [x] **Hero / Header Discipline**: Header height capped at 60px with clean single-line navigation.
- [x] **Eyebrow Discipline**: No repetitive uppercase tracking labels above every heading (strictly max 1 per 3 modules).
- [x] **No Duplicate CTA Intent**: Clear, single primary CTA per view context.
- [x] **Tabular Stability**: All monetary figures and quantity counts utilize tabular numerals (`tnum`).
- [x] **Full Cycle States**: Every component documents Initial, Loading, Success, Empty, and Error states.

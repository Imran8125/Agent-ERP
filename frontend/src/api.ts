// Typed API client for the AgentERP backend
const BASE = 'http://localhost:8000';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  is_proactive?: boolean;
};

export interface ChartSpec {
  chart_type: 'bar' | 'line' | 'area' | 'pie';
  title: string;
  description?: string;
  labels: string[];
  values: number[];
  series?: { name: string; data: number[] }[];
  summary_metrics?: { label: string; value: string }[];
  takeaway?: string;
}

export interface Conversation {
  id: string;
  title: string;
  workspace_id?: string | null;
  active_agent: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    agent?: string;
    pending_action_id?: string;
    metadata: {
      chart_spec?: ChartSpec;
      domain_focus?: string;
      affected_items?: string[];
      tool_results?: any[];
    };
    created_at: string;
  }[];
}

export interface ChatResponse {
  content: string;
  agent?: string;
  routed_to?: string;
  pending_action_id?: string;
  tool_results?: any[];
  chart_spec?: ChartSpec;
  domain_focus?: string;
  affected_items?: string[];
  conversation_id?: string;
}

export type PendingAction = {
  id: string;
  action_type: string;
  payload: any;
  summary: string;
  proposed_by: string;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
};

export type InventoryItem = {
  item_id: string;
  sku: string;
  name: string;
  description?: string;
  unit_cost: number;
  unit_price: number;
  quantity_on_hand: number;
  reorder_threshold: number;
  category?: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
};

export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  order_count: number;
  total_billed: number;
  created_at: string;
};

export type Vendor = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type TxnLine = {
  item_id: string;
  quantity: number;
  unit_price?: number;
  unit_cost?: number;
};

export type LedgerEntry = {
  id: string;
  entry_type: 'debit' | 'credit';
  account: string;
  amount: number;
  description?: string;
  entity_name?: string;
  tx_type?: string;
  created_at: string;
};

export type AuditEntry = {
  id: string;
  pending_action_id?: string;
  actor: string;
  action: string;
  detail?: any;
  created_at: string;
  prev_hash?: string;
  entry_hash?: string;
  delta?: {
    accounts_payable?: string | null;
    inventory?: string | null;
    cash?: string | null;
    revenue?: string | null;
    po_lifecycle?: string | null;
  };
};

export interface Workspace {
  id: string;
  name: string;
  code: string;
  env: 'Production' | 'Staging' | 'Sandbox';
  compute: number;
  agents: number;
  skus: number;
  currency: string;
  symbol: string;
  lastSync: string;
  active: boolean;
}

export interface FleetAgent {
  id: string;
  name: string;
  role: string;
  model: string;
  latency: string;
  tasks24h: number;
  status: 'active' | 'streaming' | 'idle';
}

export interface SystemSettings {
  sign_off_limit: number;
  daily_cap: number;
  auto_replenish: boolean;
  polling_freq: number;
  updated_at?: string;
}

export interface VendorGateway {
  id: string;
  name: string;
  protocol: string;
  endpoint: string;
  latency: string;
  status: 'online' | 'healthy' | 'offline';
  security: string;
  vendor_matched: boolean;
}

export interface DAGVerificationResult {
  valid: boolean;
  total_blocks: number;
  merkle_root: string;
  verified_at: string;
  consensus_engine: string;
  quorum: string;
  errors: any[];
}

export interface ExecutiveKPIs {
  gross_revenue: number;
  mom_growth_pct: number;
  operating_margin_pct: number;
  inventory_valuation: number;
  total_skus: number;
  total_units: number;
  active_accounts: number;
  is_reconciled: boolean;
  ledger_debit: number;
  ledger_credit: number;
}

async function api<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Chat
export const sendChat = (message: string, history: ChatMessage[], conversationId?: string) =>
  api<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history, conversation_id: conversationId }),
  });

// Conversations
export const getConversations = () =>
  api<{ ok: boolean; conversations: Conversation[] }>('/conversations');

export const createConversation = (title?: string) =>
  api<{ ok: boolean; conversation: Conversation }>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });

export const getConversation = (id: string) =>
  api<ConversationDetail & { ok: boolean }>(`/conversations/${id}`);

export const updateConversationTitle = (id: string, title: string) =>
  api<{ ok: boolean; conversation: Conversation }>(`/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });

export const deleteConversation = (id: string) =>
  api<{ ok: boolean; deleted: string }>(`/conversations/${id}`, {
    method: 'DELETE',
  });

// Inventory
export const getInventory    = ()        => api('/inventory');
export const getLowStock     = ()        => api('/inventory/low-stock');

// Finance
export const getCashPosition = ()        => api('/finance/cash');
export const getExpenses     = (days=30) => api(`/finance/expenses?period_days=${days}`);
export const getLedger       = (account?: string) =>
  api(`/finance/ledger${account ? `?account=${account}` : ''}`);

// Customers
export const getCustomers      = ()     => api('/customers');
export const getCustomerHistory = (id: string) => api(`/customers/${id}/history`);
export const createCustomer    = (data: { name: string; email?: string; phone?: string; address?: string }) =>
  api('/customers', { method: 'POST', body: JSON.stringify(data) });
export const updateCustomer    = (id: string, data: { name?: string; email?: string; phone?: string; address?: string }) =>
  api(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Vendors
export const getVendors    = () => api('/vendors');
export const createVendor  = (data: { name: string; email?: string; phone?: string; address?: string }) =>
  api('/vendors', { method: 'POST', body: JSON.stringify(data) });
export const updateVendor  = (id: string, data: { name?: string; email?: string; phone?: string; address?: string }) =>
  api(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Manual inventory entry
export const createItem  = (data: { sku: string; name: string; unit_cost?: number; unit_price?: number; quantity_on_hand?: number; reorder_threshold?: number; category?: string; description?: string }) =>
  api('/inventory', { method: 'POST', body: JSON.stringify(data) });
export const updateItem  = (id: string, data: Partial<{ sku: string; name: string; unit_cost: number; unit_price: number; quantity_on_hand: number; reorder_threshold: number; category: string; description: string }>) =>
  api(`/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const adjustItem  = (id: string, data: { delta: number; reason: string }) =>
  api(`/inventory/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) });

// Manual transactions (direct save)
export const createSale = (data: { customer_id: string; items: TxnLine[] }) =>
  api('/sales', { method: 'POST', body: JSON.stringify(data) });
export const createPO   = (data: { vendor_id: string; items: TxnLine[] }) =>
  api('/purchase-orders', { method: 'POST', body: JSON.stringify(data) });

// Reports & KPIs
export const getReport = (type: 'sales_trend' | 'top_customers' | 'inventory_value' | 'kpis') =>
  api(`/reports/${type}`);
export const getExecutiveKPIs = () => api<{ ok: boolean } & ExecutiveKPIs>('/reports/kpis');

// Pending actions
export const getPendingActions = () => api('/pending-actions');
export const getPendingAction = (id: string) =>
  api<{ ok: boolean; pending_action?: PendingAction } & Partial<PendingAction>>(`/pending-actions/${id}`);
// Normalizes both backend shapes:
//  - flat:   { ok: true, id, action_type, ... }
//  - nested: { ok: true, pending_action: { ... } }
export function normalizePendingAction(res: any): PendingAction | null {
  if (!res) return null;
  if (res.pending_action) return res.pending_action as PendingAction;
  if (res.ok && res.id) {
    const { ok: _ok, ...rest } = res;
    return rest as PendingAction;
  }
  return null;
}
export const confirmAction = (id: string) =>
  api(`/pending-actions/${id}/confirm`, { method: 'POST' });
export const rejectAction  = (id: string, reason = '') =>
  api(`/pending-actions/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });

// Audit log & DAG Verification
export const getAuditLog = (limit=100) => api(`/audit-log?limit=${limit}`);
export const verifyAuditDAG = () => api<DAGVerificationResult>('/audit-log/verify');

// Workspaces & Fleet
export const getWorkspaces = () => api<{ ok: boolean; workspaces: Workspace[] }>('/workspaces');
export const createWorkspace = (data: { name: string; currency?: string; env?: string }) =>
  api<{ ok: boolean; workspace: Workspace }>('/workspaces', { method: 'POST', body: JSON.stringify(data) });
export const switchWorkspace = (id: string) =>
  api<{ ok: boolean; switched_to: string; workspace: any }>(`/workspaces/${id}/switch`, { method: 'POST' });
export const getFleetAgents = () =>
  api<{ ok: boolean; fleet: FleetAgent[]; all_operational: boolean; active_model: string }>('/workspaces/fleet');

// Settings & Vendor Gateways
export const getSettings = () => api<SystemSettings & { ok: boolean }>('/settings');
export const updateSettings = (data: Partial<SystemSettings>) =>
  api<SystemSettings & { ok: boolean }>('/settings', { method: 'POST', body: JSON.stringify(data) });
export const getGateways = () => api<{ ok: boolean; gateways: VendorGateway[] }>('/settings/gateways');

// Models (LM Studio v1 API)
export const getModels = () => api('/api/models');
export const loadModel = (model: string, config?: Record<string, any>) =>
  api('/api/models/load', { method: 'POST', body: JSON.stringify({ model, config }) });
export const unloadModel = (instance_id: string) =>
  api('/api/models/unload', { method: 'POST', body: JSON.stringify({ instance_id }) });
export const getDownloadStatus = () => api('/api/models/download/status');

// WebSocket helper
export function createChatSocket(
  onMessage: (data: any) => void,
  onOpen?: () => void,
  onClose?: () => void,
): WebSocket {
  const ws = new WebSocket('ws://localhost:8000/ws/chat');
  ws.onopen  = () => onOpen?.();
  ws.onclose = () => onClose?.();
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  return ws;
}

// Format currency in Indian Rupees
export function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatINRShort(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`;
  return '₹' + n.toFixed(0);
}

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

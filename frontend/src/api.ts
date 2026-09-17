// Typed API client for the AgentERP backend
const BASE = 'http://localhost:8000';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  is_proactive?: boolean;
};

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
};

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
export const sendChat = (message: string, history: ChatMessage[]) =>
  api('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
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
export const createCustomer    = (data: { name: string; email?: string; phone?: string }) =>
  api('/customers', { method: 'POST', body: JSON.stringify(data) });

// Reports
export const getReport = (type: 'sales_trend' | 'top_customers' | 'inventory_value') =>
  api(`/reports/${type}`);

// Vendors
export const getVendors = () => api('/vendors');

// Pending actions
export const getPendingActions = () => api('/pending-actions');
export const confirmAction = (id: string) =>
  api(`/pending-actions/${id}/confirm`, { method: 'POST' });
export const rejectAction  = (id: string, reason = '') =>
  api(`/pending-actions/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });

// Audit log
export const getAuditLog = (limit=100) => api(`/audit-log?limit=${limit}`);

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

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, ShoppingCart, Package, DollarSign } from 'lucide-react';
import { confirmAction, rejectAction, getPendingActions, getPendingAction, normalizePendingAction, formatINR, timeAgo } from './api';
import type { PendingAction } from './api';

export interface ConfirmationCardProps {
  pendingActionId: string;
  onConfirmed?: (affectedItem?: string) => void;
  onRejected?: () => void;
}

type CardState = 'loading_data' | 'pending' | 'confirming' | 'rejecting' | 'confirmed' | 'rejected' | 'error';

function getAgentIcon(agentName: string) {
  if (agentName.includes('procurement')) return <ShoppingCart size={14} color="var(--color-accent)" />;
  if (agentName.includes('inventory'))   return <Package size={14} color="var(--color-blue)" />;
  if (agentName.includes('finance'))     return <DollarSign size={14} color="var(--color-green)" />;
  return <AlertTriangle size={14} color="var(--color-amber)" />;
}

export function ConfirmationCard({ pendingActionId, onConfirmed, onRejected }: ConfirmationCardProps) {
  const [action, setAction]   = useState<PendingAction | null>(null);
  const [state, setState]     = useState<CardState>('loading_data');
  const [error, setError]     = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Direct lookup covers pending + resolved states (backend returns flat shape).
        const direct = await getPendingAction(pendingActionId);
        if (!active) return;
        const found = normalizePendingAction(direct);
        if (found) {
          setAction(found);
          setState(found.status === 'pending' ? 'pending' : (found.status as CardState));
          return;
        }
      } catch {}

      try {
        const res = await getPendingActions();
        if (!active) return;
        const found = res.pending_actions?.find((a: PendingAction) => a.id === pendingActionId);
        if (found) {
          setAction(found);
          setState(found.status === 'pending' ? 'pending' : found.status as CardState);
        } else {
          setState('error');
          setError('Action not found');
        }
      } catch (e: any) {
        if (!active) return;
        setState('error');
        setError(e.message);
      }
    })();
    return () => { active = false; };
  }, [pendingActionId]);

  const handleConfirm = async () => {
    setState('confirming');
    try {
      await confirmAction(pendingActionId);
      setState('confirmed');
      const itemTarget = action?.payload?.sku || action?.payload?.item_id || action?.payload?.item_name || action?.payload?.name;
      onConfirmed?.(itemTarget);
    } catch (e: any) {
      setState('error');
      setError(e.message);
    }
  };

  const handleReject = async () => {
    setState('rejecting');
    try {
      await rejectAction(pendingActionId, 'Operator declined');
      setState('rejected');
      onRejected?.();
    } catch (e: any) {
      setState('error');
      setError(e.message);
    }
  };

  if (state === 'loading_data') {
    return (
      <div className="confirm-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="spinner" />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading proposed action details…</span>
      </div>
    );
  }

  if (state === 'confirmed') {
    return (
      <div className="confirm-card confirmed">
        <div className="confirm-receipt">
          <CheckCircle size={15} color="var(--color-green)" />
          <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>Action Confirmed & Executed</span>
          <span style={{ color: 'var(--color-green-border)' }}>·</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{action?.summary}</span>
        </div>
      </div>
    );
  }

  if (state === 'rejected') {
    return (
      <div className="confirm-card rejected">
        <div className="confirm-receipt">
          <XCircle size={15} color="var(--text-tertiary)" />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Proposal Declined</span>
          <span style={{ color: 'var(--color-border)' }}>·</span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>No database changes committed</span>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="confirm-card" style={{ borderColor: 'var(--color-red-border)', background: 'var(--color-red-bg)' }}>
        <div style={{ padding: 12, fontSize: 13, color: 'var(--color-red)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      </div>
    );
  }

  if (!action) return null;

  const payload = action.payload || {};
  const items: any[] = payload.items || [];
  const total = payload.total_amount || 0;
  const isLoading = state === 'confirming' || state === 'rejecting';
  const agentName = (action.proposed_by || 'master').replace('_', ' ');

  return (
    <div className="confirm-card">
      {/* Header */}
      <div className="confirm-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {getAgentIcon(action.proposed_by)}
          <span style={{ textTransform: 'capitalize' }}>{agentName} proposes:</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} />
          {timeAgo(action.created_at)}
        </div>
      </div>

      {/* Body */}
      <div className="confirm-card-body">
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
          {action.summary}
        </div>

        {/* Detail metadata */}
        {payload.vendor_name && (
          <div style={{ display: 'flex', fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ width: 100, color: 'var(--text-tertiary)' }}>Vendor:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{payload.vendor_name}</span>
          </div>
        )}
        {payload.customer_name && (
          <div style={{ display: 'flex', fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ width: 100, color: 'var(--text-tertiary)' }}>Customer:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{payload.customer_name}</span>
          </div>
        )}
        {action.action_type === 'adjust_stock' && payload.item_name && (
          <div style={{ display: 'flex', fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ width: 100, color: 'var(--text-tertiary)' }}>Adjustment:</span>
            <span style={{ color: payload.delta > 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 600 }}>
              {payload.delta > 0 ? '+' : ''}{payload.delta} units ({payload.old_qty} → {payload.new_qty})
            </span>
          </div>
        )}

        {/* Line items table */}
        {items.length > 0 && (
          <table className="confirm-item-table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Item Description</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit Cost</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => {
                const price = item.unit_cost || item.unit_price || 0;
                return (
                  <tr key={i}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                      {item.sku && <span className="mono-data" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>({item.sku})</span>}
                    </td>
                    <td className="tabular-data" style={{ textAlign: 'right' }}>{item.quantity}</td>
                    <td className="tabular-data" style={{ textAlign: 'right' }}>{formatINR(price)}</td>
                    <td className="tabular-data" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatINR(price * item.quantity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Total calculation row */}
        {total > 0 && (
          <div className="confirm-summary-row">
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Transaction Amount</span>
            <span className="confirm-total-amount">{formatINR(total)}</span>
          </div>
        )}

        {/* Explicit Human Confirmation Actions */}
        <div className="confirm-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleReject}
            disabled={isLoading}
          >
            {state === 'rejecting' ? <div className="spinner" /> : <XCircle size={13} />}
            <span>Decline Proposal</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {state === 'confirming' ? (
              <>
                <div className="spinner" style={{ borderTopColor: '#FFFFFF' }} />
                <span>Posting to Ledger…</span>
              </>
            ) : (
              <>
                <CheckCircle size={13} />
                <span>Confirm & Place Order</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationCard;

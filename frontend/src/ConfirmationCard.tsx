import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { confirmAction, rejectAction, getPendingActions, formatINR, timeAgo } from './api';
import type { PendingAction } from './api';

export interface ConfirmationCardProps {
  pendingActionId: string;
  onConfirmed: () => void;
  onRejected: () => void;
}

type CardState = 'loading_data' | 'pending' | 'confirming' | 'rejecting' | 'confirmed' | 'rejected' | 'error';

function formatActionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function ConfirmationCard({ pendingActionId, onConfirmed, onRejected }: ConfirmationCardProps) {
  const [action, setAction]   = useState<PendingAction | null>(null);
  const [state, setState]     = useState<CardState>('loading_data');
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await getPendingActions();
        const found = res.pending_actions?.find((a: PendingAction) => a.id === pendingActionId);
        if (found) {
          setAction(found);
          setState(found.status === 'pending' ? 'pending' : found.status as CardState);
        } else {
          setState('error');
          setError('Action not found');
        }
      } catch (e: any) {
        setState('error');
        setError(e.message);
      }
    })();
  }, [pendingActionId]);

  const handleConfirm = async () => {
    setState('confirming');
    try {
      await confirmAction(pendingActionId);
      setState('confirmed');
      onConfirmed();
    } catch (e: any) {
      setState('error');
      setError(e.message);
    }
  };

  const handleReject = async () => {
    setState('rejecting');
    try {
      await rejectAction(pendingActionId, 'User rejected');
      setState('rejected');
      onRejected();
    } catch (e: any) {
      setState('error');
      setError(e.message);
    }
  };

  if (state === 'loading_data') {
    return (
      <div className="confirm-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="spinner" />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading action details…</span>
      </div>
    );
  }

  if (state === 'confirmed') {
    return (
      <div className="confirm-card confirmed">
        <div className="confirm-receipt">
          <CheckCircle size={16} color="var(--color-green)" />
          <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>Action confirmed</span>
          <span style={{ color: 'var(--text-secondary)' }}>·</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{action?.summary}</span>
        </div>
      </div>
    );
  }

  if (state === 'rejected') {
    return (
      <div className="confirm-card rejected">
        <div className="confirm-receipt">
          <XCircle size={16} color="var(--color-red)" />
          <span style={{ color: 'var(--color-red)', fontWeight: 600 }}>Action rejected</span>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="confirm-card" style={{ borderColor: 'rgba(239,68,68,0.3)', borderLeftColor: 'var(--color-red)' }}>
        <div style={{ padding: 12, fontSize: 13, color: 'var(--color-red)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      </div>
    );
  }

  if (!action) return null;

  const payload = action.payload;
  const items: any[] = payload.items || [];
  const total = payload.total_amount || 0;
  const isLoading = state === 'confirming' || state === 'rejecting';

  return (
    <div className={`confirm-card ${isLoading ? 'loading' : ''}`}>
      {/* Header */}
      <div className="confirm-card-header">
        <div className="confirm-card-title">
          <AlertTriangle size={14} />
          Review Action — {formatActionType(action.action_type)}
        </div>
        <div className="confirm-card-meta">
          <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
          {timeAgo(action.created_at)} · Proposed by {action.proposed_by.replace('_', ' ')}
        </div>
      </div>

      {/* Body */}
      <div className="confirm-card-body">
        {/* Detail rows */}
        {payload.vendor_name && (
          <div className="confirm-detail-row">
            <span className="confirm-detail-label">Vendor</span>
            <span className="confirm-detail-value">{payload.vendor_name}</span>
          </div>
        )}
        {payload.customer_name && (
          <div className="confirm-detail-row">
            <span className="confirm-detail-label">Customer</span>
            <span className="confirm-detail-value">{payload.customer_name}</span>
          </div>
        )}
        {action.action_type === 'adjust_stock' && payload.item_name && (
          <>
            <div className="confirm-detail-row">
              <span className="confirm-detail-label">Item</span>
              <span className="confirm-detail-value">{payload.item_name} ({payload.sku})</span>
            </div>
            <div className="confirm-detail-row">
              <span className="confirm-detail-label">Adjustment</span>
              <span className="confirm-detail-value" style={{ color: payload.delta > 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {payload.delta > 0 ? '+' : ''}{payload.delta} units ({payload.old_qty} → {payload.new_qty})
              </span>
            </div>
            <div className="confirm-detail-row">
              <span className="confirm-detail-label">Reason</span>
              <span className="confirm-detail-value">{payload.reason}</span>
            </div>
          </>
        )}

        {/* Line items table */}
        {items.length > 0 && (
          <div className="confirm-line-items" style={{ marginTop: 12 }}>
            <div className="confirm-line-header">
              <span>Item</span>
              <span style={{ textAlign: 'right' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Unit Price</span>
              <span style={{ textAlign: 'right' }}>Total</span>
            </div>
            {items.map((item: any, i: number) => (
              <div key={i} className="confirm-line-row">
                <div>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.sku}</div>
                </div>
                <div className="price">{item.quantity}</div>
                <div className="price">{formatINR(item.unit_cost || item.unit_price || 0)}</div>
                <div className="price" style={{ fontWeight: 600 }}>
                  {formatINR((item.unit_cost || item.unit_price || 0) * item.quantity)}
                </div>
              </div>
            ))}
            <div className="confirm-total">
              <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 12 }}>Total Amount</span>
              <span style={{ color: 'var(--text-primary)', fontSize: 16 }}>{formatINR(total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="confirm-actions">
        <button
          className="btn btn-success"
          onClick={handleConfirm}
          disabled={isLoading}
          style={{ flex: 1 }}
        >
          {state === 'confirming'
            ? <><div className="spinner" style={{ borderTopColor: 'var(--color-green)' }} /> Confirming…</>
            : <><CheckCircle size={14} /> Confirm</>}
        </button>
        <button
          className="btn btn-danger"
          onClick={handleReject}
          disabled={isLoading}
          style={{ flex: 1 }}
        >
          {state === 'rejecting'
            ? <><div className="spinner" style={{ borderTopColor: 'var(--color-red)' }} /> Rejecting…</>
            : <><XCircle size={14} /> Reject</>}
        </button>
      </div>
    </div>
  );
}

export default ConfirmationCard;

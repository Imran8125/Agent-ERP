import { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, Clock, ShoppingCart,
  Building, Truck, ShieldCheck, AlertCircle, FileCheck
} from 'lucide-react';
import { confirmAction, rejectAction, getPendingActions, getPendingAction, normalizePendingAction, formatINR, timeAgo, type PendingAction } from '../api';

export interface PODraftCardProps {
  pendingActionId: string;
  onConfirmed?: (affectedItem?: string) => void;
  onRejected?: () => void;
}

type CardState = 'loading' | 'pending' | 'confirming' | 'rejecting' | 'confirmed' | 'rejected' | 'error';

export function PODraftCard({ pendingActionId, onConfirmed, onRejected }: PODraftCardProps) {
  const [action, setAction] = useState<PendingAction | null>(null);
  const [state, setState] = useState<CardState>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Direct ID lookup works for pending, confirmed, and rejected states.
        // Backend returns a flat shape { ok, id, ... }; normalizePendingAction
        // also accepts the legacy nested { pending_action: {...} } shape.
        const direct = await getPendingAction(pendingActionId);
        if (!active) return;
        const found = normalizePendingAction(direct);
        if (found) {
          setAction(found);
          setState(found.status === 'pending' ? 'pending' : (found.status as CardState));
          return;
        }
      } catch {
        // Fall through to active list / error state below.
      }

      try {
        const res = await getPendingActions();
        if (!active) return;
        const found = res.pending_actions?.find((a: PendingAction) => a.id === pendingActionId);
        if (found) {
          setAction(found);
          setState(found.status === 'pending' ? 'pending' : found.status as CardState);
        } else {
          setState('error');
          setError('Pending order action not found');
        }
      } catch (e: any) {
        if (!active) return;
        setState('error');
        setError(e.message || 'Failed to load order');
      }
    })();

    return () => { active = false; };
  }, [pendingActionId]);

  const handleConfirm = async () => {
    setState('confirming');
    try {
      await confirmAction(pendingActionId);
      setState('confirmed');
      const itemTarget = action?.payload?.sku || action?.payload?.item_id || action?.payload?.items?.[0]?.sku || action?.payload?.items?.[0]?.name;
      onConfirmed?.(itemTarget);
    } catch (e: any) {
      setState('error');
      setError(e.message || 'Failed to confirm purchase order');
    }
  };

  const handleReject = async () => {
    setState('rejecting');
    try {
      await rejectAction(pendingActionId, 'Declined by operator');
      setState('rejected');
      onRejected?.();
    } catch (e: any) {
      setState('error');
      setError(e.message);
    }
  };

  if (state === 'loading') {
    return (
      <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="spinner" />
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Loading PO draft specifications…</span>
      </div>
    );
  }

  if (state === 'confirmed') {
    return (
      <div className="card" style={{
        padding: '16px 20px',
        background: 'var(--color-green-subtle)',
        border: '1px solid var(--color-green-border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileCheck size={18} color="var(--color-green)" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-green)' }}>
                PURCHASE ORDER AUTHORIZED & TRANSMITTED
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                {action?.summary} · Logged in ledger & inventory pipeline
              </div>
            </div>
          </div>
          <span className="badge badge-green" style={{ textTransform: 'uppercase', fontSize: 10.5 }}>
            PO-{pendingActionId.slice(0, 8).toUpperCase()}
          </span>
        </div>
      </div>
    );
  }

  if (state === 'rejected') {
    return (
      <div className="card" style={{
        padding: '14px 18px',
        background: 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <XCircle size={16} color="var(--text-tertiary)" />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Purchase Order Proposal Cancelled
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              No ledger debits committed
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="card" style={{ padding: '12px 16px', border: '1px solid var(--color-red-border)', background: 'var(--color-red-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-red)', fontSize: 12 }}>
          <AlertCircle size={14} /> {error}
        </div>
      </div>
    );
  }

  if (!action) return null;

  const payload = action.payload || {};
  const items: any[] = payload.items || [];
  const subtotal = payload.total_amount || items.reduce((sum, it) => sum + ((it.unit_cost || it.unit_price || 0) * (it.quantity || 1)), 0);
  const estTax = Math.round(subtotal * 0.18); // standard 18% GST estimate
  const grandTotal = subtotal + estTax;
  const isBusy = state === 'confirming' || state === 'rejecting';
  const poNumber = `PO-${action.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="card" style={{
      border: '1px solid var(--color-accent-subtle)',
      boxShadow: '0 4px 20px rgba(67, 56, 202, 0.08)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginTop: 8,
      marginBottom: 8,
      background: '#FFFFFF',
    }}>
      {/* Top Accent Document Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
        color: '#FFFFFF',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingCart size={15} color="#A5B4FC" />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Purchase Order Draft
          </span>
          <span className="mono-data" style={{
            fontSize: 11,
            background: 'rgba(255, 255, 255, 0.15)',
            padding: '2px 7px',
            borderRadius: 3,
            color: '#E0E7FF',
          }}>
            {poNumber}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10.5,
            fontWeight: 600,
            color: '#FEF08A',
            background: 'rgba(234, 179, 8, 0.2)',
            border: '1px solid rgba(250, 204, 21, 0.4)',
            padding: '2px 8px',
            borderRadius: 999,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FACC15' }} />
            PENDING AUTHORIZATION
          </span>
        </div>
      </div>

      {/* PO Meta Details Banner */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        fontSize: 12,
      }}>
        <div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Vendor Entity</span>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Building size={12} color="var(--color-accent)" />
            {payload.vendor_name || 'Acme Industrial Supplies'}
          </div>
        </div>

        <div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Destination Hub</span>
          <div style={{ fontWeight: 500, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Truck size={12} />
            Node-01 Central Warehouse
          </div>
        </div>

        <div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Settlement Terms</span>
          <div style={{ fontWeight: 500, color: 'var(--text-secondary)', marginTop: 2 }}>
            Net 30 Days · INR (₹)
          </div>
        </div>

        <div>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 600 }}>Created</span>
          <div style={{ fontWeight: 500, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> {timeAgo(action.created_at)}
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
          Ordered Bill of Materials
        </div>

        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-subtle)' }}>
                <th>SKU / Item</th>
                <th style={{ textAlign: 'right', width: 70 }}>Qty</th>
                <th style={{ textAlign: 'right', width: 100 }}>Unit Cost</th>
                <th style={{ textAlign: 'right', width: 110 }}>Extended</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, idx: number) => {
                const cost = it.unit_cost || it.unit_price || 0;
                const qty = it.quantity || 1;
                return (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{it.name || it.item_name}</div>
                      {it.sku && (
                        <span className="mono-data" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                          {it.sku}
                        </span>
                      )}
                    </td>
                    <td className="tabular-data" style={{ textAlign: 'right' }}>{qty}</td>
                    <td className="tabular-data" style={{ textAlign: 'right' }}>{formatINR(cost)}</td>
                    <td className="tabular-data" style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(cost * qty)}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 12 }}>
                    {action.summary}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ledger Balance & Grand Total Calculation */}
        <div style={{
          marginTop: 14,
          padding: '12px 14px',
          background: 'var(--color-surface-subtle)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} color="var(--color-green)" />
            <span>Impact: Debit <strong style={{ color: 'var(--text-secondary)' }}>Inventory</strong> · Credit <strong style={{ color: 'var(--text-secondary)' }}>Accounts Payable</strong></span>
          </div>

          <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Subtotal: {formatINR(subtotal)} + Est. Tax: {formatINR(estTax)}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Total Commitment:</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {formatINR(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Confirmation Actions Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
        }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleReject}
            disabled={isBusy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            {state === 'rejecting' ? <div className="spinner" /> : <XCircle size={13} />}
            <span>Decline PO</span>
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
            disabled={isBusy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(135deg, #4338CA 0%, #3730A3 100%)',
              fontWeight: 600,
              padding: '7px 14px',
            }}
          >
            {state === 'confirming' ? (
              <>
                <div className="spinner" style={{ borderTopColor: '#FFFFFF' }} />
                <span>Posting PO & Updating Ledger…</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Authorize & Dispatch PO</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PODraftCard;

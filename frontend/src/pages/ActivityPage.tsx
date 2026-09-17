import { useState, useEffect, type ReactNode } from 'react';
import { getAuditLog, timeAgo } from '../api';
import type { AuditEntry } from '../api';
import { CheckCircle, XCircle, Bot, User, Settings } from 'lucide-react';

type AuditFilter = 'all' | 'confirmed' | 'proposed' | 'rejected';

const ACTION_META: Record<string, { icon: ReactNode; color: string; label: string }> = {
  confirmed: { icon: <CheckCircle size={14}/>,  color: 'var(--color-green)',  label: 'Confirmed' },
  rejected:  { icon: <XCircle size={14}/>,      color: 'var(--color-red)',    label: 'Rejected'  },
  proposed:  { icon: <Bot size={14}/>,          color: 'var(--color-amber)',  label: 'Proposed'  },
  tool_call: { icon: <Settings size={14}/>,     color: 'var(--color-accent)', label: 'Tool Call' },
};

export function ActivityPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter,  setFilter]  = useState<AuditFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLog(200)
      .then(res => { if (res.ok) setEntries(res.entries); })
      .finally(() => setLoading(false));
    const interval = setInterval(() => {
      getAuditLog(200).then(res => { if (res.ok) setEntries(res.entries); });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = entries.filter(e => {
    if (filter === 'all')       return true;
    if (filter === 'confirmed') return e.action === 'confirmed';
    if (filter === 'proposed')  return e.action === 'proposed';
    if (filter === 'rejected')  return e.action === 'rejected';
    return true;
  });

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Activity & Audit Log</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            <span className="live-dot" />
            Immutable record of all agent actions and user decisions
          </p>
        </div>
        <div className="tabs">
          {([
            ['all',       'All Events'],
            ['confirmed', 'Confirmed Writes'],
            ['proposed',  'Agent Proposals'],
            ['rejected',  'Rejected'],
          ] as [AuditFilter, string][]).map(([id, label]) => (
            <button key={id} className={`tab-btn ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>No activity yet</div>
        ) : filtered.map(entry => {
          const meta = ACTION_META[entry.action] || ACTION_META.tool_call;
          const isUser = entry.actor === 'user';
          return (
            <div key={entry.id} className="activity-item">
              <div className="activity-icon" style={{ background: meta.color + '20' }}>
                <span style={{ color: meta.color }}>{isUser ? <User size={14}/> : meta.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div className="activity-title">
                  <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
                  {' '}&mdash;{' '}
                  <span style={{ fontWeight: 400 }}>
                    {entry.detail?.tool ? `${entry.detail.tool}()` :
                     entry.detail?.summary ? entry.detail.summary.slice(0, 80) + (entry.detail.summary.length > 80 ? '…' : '') :
                     entry.detail?.action_type || entry.action}
                  </span>
                </div>
                <div className="activity-meta">
                  <strong>{entry.actor}</strong>
                  {entry.pending_action_id && (
                    <> · <code className="text-mono" style={{ fontSize: 10, opacity: 0.7 }}>{entry.pending_action_id.slice(0, 8)}…</code></>
                  )}
                </div>
                {entry.detail && Object.keys(entry.detail).length > 0 && (
                  <div className="activity-detail">
                    {JSON.stringify(entry.detail).slice(0, 120)}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 16 }}>
                {timeAgo(entry.created_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

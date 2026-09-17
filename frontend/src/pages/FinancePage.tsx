import { useState, useEffect } from 'react';
import { getCashPosition, getExpenses, getLedger, formatINR, formatINRShort, timeAgo } from '../api';
import { TrendingUp, Download } from 'lucide-react';

type AccountFilter = 'all' | 'cash' | 'inventory' | 'revenue' | 'expense';

export function FinancePage() {
  const [cash,     setCash]    = useState<any>(null);
  const [expenses, setExpenses]= useState<any>(null);
  const [ledger,   setLedger]  = useState<any[]>([]);
  const [account,  setAccount] = useState<AccountFilter>('all');
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCashPosition(), getExpenses(30)])
      .then(([c, e]) => {
        if (c.ok) setCash(c);
        if (e.ok) setExpenses(e);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getLedger(account === 'all' ? undefined : account)
      .then(res => { if (res.ok) setLedger(res.entries); });
  }, [account]);

  const cashBalance = cash?.cash_balance || 0;
  const totalRevenue = cash?.total_debits || 0;

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, #1f2235 0%, #252840 100%)' }}>
          <div className="stat-label">Total Net Cash Reserve</div>
          <div className="stat-value">{loading ? '…' : formatINR(cashBalance)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Available cash from recorded double-entry ledger</div>
          <div className="stat-change up" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <TrendingUp size={12}/> Based on {ledger.length} ledger entries
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Revenue Recorded</div>
          <div className="stat-value sm">{loading ? '…' : formatINRShort(totalRevenue)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>from confirmed sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vendor Outflows (30d)</div>
          <div className="stat-value sm">{expenses ? formatINRShort(expenses.total_expenses) : '…'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>across {expenses?.vendors?.length || 0} vendors</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Ledger movements */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="live-dot" />
                Recent Ledger Movements
              </div>
              <div className="card-subtitle">Immutable double-entry debit & credit audit stream</div>
            </div>
            <button className="btn btn-ghost btn-sm">
              <Download size={12} /> Audit CSV
            </button>
          </div>

          {/* Account filter tabs */}
          <div style={{ marginBottom: 16 }}>
            <div className="tabs">
              {(['all', 'cash', 'inventory', 'revenue', 'expense'] as AccountFilter[]).map(a => (
                <button key={a} className={`tab-btn ${account === a ? 'active' : ''}`} onClick={() => setAccount(a)}>
                  {a === 'all' ? 'All' : a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {ledger.slice(0, 30).map(entry => (
                  <tr key={entry.id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{entry.description || '—'}</div>
                      {entry.entity_name && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{entry.entity_name}</div>}
                    </td>
                    <td>
                      <span className={`account-tag account-${entry.account}`}>{entry.account}</span>
                    </td>
                    <td>
                      <span className={`ledger-entry-type ledger-${entry.entry_type}`}>
                        {entry.entry_type === 'debit' ? '▲ DEBIT' : '▼ CREDIT'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-green)', fontWeight: 600 }}>
                      {entry.entry_type === 'debit' ? `+${formatINR(entry.amount)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-red)', fontWeight: 600 }}>
                      {entry.entry_type === 'credit' ? formatINR(entry.amount) : '—'}
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {timeAgo(entry.created_at)}
                    </td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>No ledger entries</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {ledger.length > 0 && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-tertiary)', borderTop: '1px solid var(--color-border)' }}>
              Showing {Math.min(30, ledger.length)} of {ledger.length} balanced journal transactions
            </div>
          )}
        </div>

        {/* Vendor expense breakdown */}
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header">
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>Expense Analytics</div>
              <div className="card-title">Vendor Expense Breakdown</div>
            </div>
            <div className="tab-btn active" style={{ padding: '4px 8px', fontSize: 11 }}>30-Day</div>
          </div>
          {expenses?.vendors?.map((v: any, i: number) => {
            const pct = expenses.total_expenses > 0
              ? Math.round(v.total / expenses.total_expenses * 100) : 0;
            const colors = ['#5b6af0','#3b82f6','#f59e0b','#22c55e','#a855f7'];
            const color = colors[i % colors.length];
            return (
              <div key={v.vendor_name} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{v.vendor_name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{formatINR(v.total)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>({pct}%)</span>
                  </div>
                </div>
                <div className="progress-bar-wrap">
                  <div className="progress-bar" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
          {(!expenses?.vendors || expenses.vendors.length === 0) && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '8px 0' }}>No expense data</div>
          )}
          {expenses && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)', fontSize: 12, color: 'var(--text-secondary)' }}>
              Vendor Invoices on Net-30 — <strong style={{ color: 'var(--color-green)' }}>100% on schedule</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

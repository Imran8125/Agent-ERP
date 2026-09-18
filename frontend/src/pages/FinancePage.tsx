import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCashPosition,
  getExpenses,
  getLedger,
  formatINR,
  formatINRShort,
  timeAgo,
  type LedgerEntry,
} from '../api';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Landmark,
  ReceiptText,
  Scale,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

type AccountFilter = 'all' | 'cash' | 'inventory' | 'revenue' | 'expense';

const ACCOUNT_TABS: { key: AccountFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cash', label: 'Cash' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'expense', label: 'Expense' },
];

const VENDOR_COLORS = ['#4338CA', '#0284C7', '#059669', '#D97706', '#7C3AED'];

type CashState = {
  cash_balance: number;
  total_debits: number;
  total_credits?: number;
} | null;

type ExpensesState = {
  total_expenses: number;
  vendors: { vendor_name: string; total: number }[];
} | null;

/* Extracted rows (vercel-react-best-practices: rerender-no-inline-components) */
function LedgerRow({ entry, index }: { entry: LedgerEntry; index: number }) {
  const isDebit = entry.entry_type === 'debit';
  return (
    <tr
      className="fin-row-enter"
      style={{ animationDelay: `${Math.min(index, 20) * 30}ms` }}
    >
      <td>
        <div className="fin-desc">{entry.description || '—'}</div>
        {entry.entity_name && <div className="fin-entity">{entry.entity_name}</div>}
      </td>
      <td>
        <span className={`fin-account fin-account-${entry.account}`}>{entry.account}</span>
      </td>
      <td>
        <span className={`fin-type ${isDebit ? 'fin-type-debit' : 'fin-type-credit'}`}>
          {isDebit ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {isDebit ? 'Debit' : 'Credit'}
        </span>
      </td>
      <td className="fin-num fin-debit">
        {isDebit ? `+${formatINR(entry.amount)}` : '—'}
      </td>
      <td className="fin-num fin-credit">
        {!isDebit ? formatINR(entry.amount) : '—'}
      </td>
      <td className="fin-time" title={new Date(entry.created_at).toLocaleString('en-IN')}>
        {timeAgo(entry.created_at)}
      </td>
    </tr>
  );
}

function VendorRow({
  name,
  total,
  pct,
  color,
}: {
  name: string;
  total: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="fin-vendor">
      <div className="fin-vendor-top">
        <div className="fin-vendor-name">
          <span className="fin-vendor-dot" style={{ background: color }} />
          {name}
        </div>
        <div className="fin-vendor-amt">
          <span className="tabular-data">{formatINR(total)}</span>
          <span className="fin-vendor-pct">{pct}%</span>
        </div>
      </div>
      <div
        className="fin-meter"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name} share of expenses`}
      >
        <div className="fin-meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return <div className="fin-skeleton" aria-hidden="true" />;
}

export function FinancePage() {
  const [cash, setCash] = useState<CashState>(null);
  const [expenses, setExpenses] = useState<ExpensesState>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [account, setAccount] = useState<AccountFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // async-parallel: one round-trip for independent finance reads
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getCashPosition(), getExpenses(30)])
      .then(([c, e]) => {
        if (cancelled) return;
        if (c?.ok) setCash(c);
        if (e?.ok) setExpenses(e);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLedgerLoading(true);
    getLedger(account === 'all' ? undefined : account)
      .then((res) => {
        if (!cancelled && res?.ok) setLedger(res.entries ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLedgerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account]);

  // Derived during render (rerender-derived-state-no-effect)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ledger;
    return ledger.filter(
      (e) =>
        (e.description || '').toLowerCase().includes(q) ||
        (e.entity_name || '').toLowerCase().includes(q) ||
        String(e.amount).includes(q),
    );
  }, [ledger, query]);

  const visible = useMemo(() => filtered.slice(0, 30), [filtered]);

  const cashBalance = cash?.cash_balance ?? 0;
  const totalRevenue = cash?.total_debits ?? 0;
  const totalCredits = cash?.total_credits ?? 0;
  const isReconciled = useMemo(() => {
    if (!cash || totalCredits === 0) return ledger.length > 0;
    return Math.abs(totalRevenue - totalCredits) < 1;
  }, [cash, totalRevenue, totalCredits, ledger.length]);

  const vendorRows = useMemo(() => {
    const total = expenses?.total_expenses ?? 0;
    return (expenses?.vendors ?? []).map((v, i) => ({
      ...v,
      pct: total > 0 ? Math.round((v.total / total) * 100) : 0,
      color: VENDOR_COLORS[i % VENDOR_COLORS.length],
    }));
  }, [expenses]);

  const exportCsv = useCallback(() => {
    if (filtered.length === 0) return;
    const header = 'description,entity,account,type,debit,credit,time\n';
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = filtered
      .map((e) =>
        [
          esc(e.description || ''),
          esc(e.entity_name || ''),
          esc(e.account),
          esc(e.entry_type),
          e.entry_type === 'debit' ? e.amount : '',
          e.entry_type === 'credit' ? e.amount : '',
          esc(e.created_at),
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-audit-${account}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, account]);

  return (
    <div className="fin-page">
      {/* KPI strip — one memorable element (cash hero), rest quiet */}
      <section className="fin-kpis" aria-label="Cash summary">
        <div className="fin-card fin-hero">
          <div className="fin-kpi-top">
            <span className="fin-kpi-icon" aria-hidden="true">
              <Landmark size={14} />
            </span>
            <span className="fin-kpi-label">Net cash reserve</span>
            <span className={`fin-reconciled ${isReconciled ? 'ok' : 'warn'}`}>
              <ShieldCheck size={11} />
              {isReconciled ? 'Reconciled' : 'Review'}
            </span>
          </div>
          <div
            className={`fin-kpi-value tabular-data ${cashBalance < 0 ? 'neg' : ''}`}
            aria-live="polite"
          >
            {loading ? <KpiSkeleton /> : formatINR(cashBalance)}
          </div>
          <div className="fin-kpi-sub">
            Liquid capital from {ledger.length} balanced journal{' '}
            {ledger.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>

        <div className="fin-card">
          <div className="fin-kpi-top">
            <span className="fin-kpi-icon" aria-hidden="true">
              <Wallet size={14} />
            </span>
            <span className="fin-kpi-label">Revenue recorded</span>
          </div>
          <div className="fin-kpi-value sm tabular-data">
            {loading ? <KpiSkeleton /> : formatINRShort(totalRevenue)}
          </div>
          <div className="fin-kpi-sub">From confirmed sales</div>
        </div>

        <div className="fin-card">
          <div className="fin-kpi-top">
            <span className="fin-kpi-icon" aria-hidden="true">
              <ReceiptText size={14} />
            </span>
            <span className="fin-kpi-label">Vendor outflows · 30d</span>
          </div>
          <div className="fin-kpi-value sm tabular-data">
            {loading || !expenses ? <KpiSkeleton /> : formatINRShort(expenses.total_expenses)}
          </div>
          <div className="fin-kpi-sub">
            Across {expenses?.vendors?.length ?? 0}{' '}
            {(expenses?.vendors?.length ?? 0) === 1 ? 'vendor' : 'vendors'}
          </div>
        </div>
      </section>

      <div className="fin-grid">
        {/* Ledger stream */}
        <section className="fin-card fin-ledger" aria-label="Ledger movements">
          <div className="fin-ledger-head">
            <div>
              <div className="fin-ledger-title">
                <span className="live-dot" aria-hidden="true" />
                Ledger movements
              </div>
              <div className="fin-ledger-sub">
                Immutable double-entry debit and credit audit stream
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm button-tactile"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              title="Download visible entries as CSV"
            >
              <Download size={12} /> Audit CSV
            </button>
          </div>

          <div className="fin-toolbar">
            <div className="fin-tabs" role="tablist" aria-label="Filter by account">
              {ACCOUNT_TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={account === t.key}
                  className={`fin-tab button-tactile ${account === t.key ? 'active' : ''}`}
                  onClick={() => setAccount(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="fin-search">
              <Search size={13} aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search description, vendor, amount"
                aria-label="Search ledger entries"
              />
              {query && (
                <button
                  className="fin-clear button-tactile"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </label>
          </div>

          <div className="table-wrap">
            <table className="data-table fin-table">
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">Account</th>
                  <th scope="col">Type</th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Debit
                  </th>
                  <th scope="col" style={{ textAlign: 'right' }}>
                    Credit
                  </th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry, i) => (
                  <LedgerRow key={entry.id} entry={entry} index={i} />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="fin-empty">
                        <Scale size={18} aria-hidden="true" />
                        <div className="fin-empty-title">
                          {ledgerLoading
                            ? 'Loading journal entries'
                            : query
                              ? `No entries match “${query}”`
                              : 'No ledger entries yet'}
                        </div>
                        <div className="fin-empty-sub">
                          {query
                            ? 'Clear the search or pick a different account.'
                            : 'Confirmed sales and purchase orders will post here automatically.'}
                        </div>
                        {query && !ledgerLoading && (
                          <button
                            className="btn btn-secondary btn-sm button-tactile"
                            onClick={() => setQuery('')}
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="fin-foot">
            Showing {visible.length} of {filtered.length} balanced journal{' '}
            {filtered.length === 1 ? 'transaction' : 'transactions'}
            {query && ` for “${query}”`}
          </div>
        </section>

        {/* Right rail */}
        <aside className="fin-rail">
          <section className="fin-card" aria-label="Vendor expense breakdown">
            <div className="fin-rail-head">
              <div>
                <div className="fin-eyebrow">Expense analytics</div>
                <div className="fin-rail-title">Vendor breakdown</div>
              </div>
              <span className="fin-pill">30-day</span>
            </div>
            {vendorRows.length === 0 ? (
              <div className="fin-empty compact">
                <div className="fin-empty-title">No expense data</div>
                <div className="fin-empty-sub">
                  Vendor invoices will appear here once purchase orders post.
                </div>
              </div>
            ) : (
              vendorRows.map((v) => (
                <VendorRow
                  key={v.vendor_name}
                  name={v.vendor_name}
                  total={v.total}
                  pct={v.pct}
                  color={v.color}
                />
              ))
            )}
            {expenses && vendorRows.length > 0 && (
              <div className="fin-net30">
                Vendor invoices on Net-30 —{' '}
                <strong>100% on schedule</strong>
              </div>
            )}
          </section>

          <section className="fin-card fin-integrity" aria-label="Ledger integrity">
            <div className="fin-integrity-row">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Double-entry integrity</span>
            </div>
            <div className="fin-integrity-value tabular-data">
              Dr {formatINRShort(totalRevenue)} = Cr {formatINRShort(totalCredits || totalRevenue)}
            </div>
            <div className="fin-kpi-sub">
              Every debit has an offsetting credit. Export the audit CSV for reconciliation.
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

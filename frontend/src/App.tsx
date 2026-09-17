import { useState, useEffect } from 'react';
import './index.css';
import { Sidebar, type Page } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatPanel } from './ChatPanel';
import { InventoryTable } from './InventoryTable';
import { ReportCharts } from './ReportCharts';
import { CustomersPage } from './pages/CustomersPage';
import { FinancePage } from './pages/FinancePage';
import { ActivityPage } from './pages/ActivityPage';
import { getPendingActions, createChatSocket, getLowStock, getCashPosition } from './api';
import { ShoppingCart, DollarSign, BarChart2, AlertTriangle, Bot } from 'lucide-react';

const PAGE_TITLES: Record<Page, { breadcrumb: string; title: string }> = {
  overview:  { breadcrumb: 'AUTONOMOUS OPS',          title: 'Overview & Chat'         },
  inventory: { breadcrumb: 'INVENTORY MANAGEMENT',    title: 'Inventory'               },
  customers: { breadcrumb: 'CUSTOMER RELATIONS',      title: 'Customers'               },
  finance:   { breadcrumb: 'AUTONOMOUS ACCOUNTING',   title: 'Finance & Cash Position' },
  reports:   { breadcrumb: 'BUSINESS ANALYTICS',      title: 'Reports'                 },
  activity:  { breadcrumb: 'AUDIT',                   title: 'Activity / Audit Log'    },
};

export default function App() {
  const [page,        setPage]        = useState<Page>('overview');
  const [pendingCount, setPendingCount] = useState(0);
  const [agentInput,  setAgentInput]  = useState('');
  const [hasNotif,    setHasNotif]    = useState(false);
  const [flashItemId]                 = useState<string | undefined>();

  // Poll pending actions count
  useEffect(() => {
    const refresh = () => {
      getPendingActions()
        .then(res => setPendingCount(res.pending_actions?.length || 0))
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket for proactive alerts
  useEffect(() => {
    let ws: WebSocket;
    const connect = () => {
      try {
        ws = createChatSocket(
          (data) => {
            if (data.type === 'proactive_alert' || data.type === 'new_pending_action') {
              setHasNotif(true);
              setPendingCount(c => c + 1);
            }
            if (data.type === 'action_confirmed') {
              setPendingCount(c => Math.max(0, c - 1));
            }
          },
          () => console.log('WS connected'),
          () => setTimeout(connect, 3000),
        );
      } catch {
        setTimeout(connect, 3000);
      }
    };
    connect();
    return () => { try { ws?.close(); } catch {} };
  }, []);

  const { breadcrumb, title } = PAGE_TITLES[page];

  const renderPageContent = () => {
    switch (page) {
      case 'overview':
        return (
          <div className="two-col-layout">
            <ChatPanel
              agentInput={agentInput}
              onAgentInputClear={() => setAgentInput('')}
              onPendingAction={() => { setPendingCount(c => c + 1); setHasNotif(true); }}
            />
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 16px 20px 0' }}>
              <QuickStats />
            </div>
          </div>
        );
      case 'inventory':
        return <InventoryTable flashItemId={flashItemId} />;
      case 'customers':
        return <CustomersPage />;
      case 'finance':
        return <FinancePage />;
      case 'reports':
        return (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <ReportCharts />
          </div>
        );
      case 'activity':
        return <ActivityPage />;
    }
  };

  return (
    <div className="app-layout">
      <Header
        onAgentClick={(tag) => { setPage('overview'); setAgentInput(tag); }}
        hasNotif={hasNotif}
      />
      <Sidebar current={page} onChange={setPage} pendingCount={pendingCount} />
      <main className="app-main main-content">
        {/* Page title bar */}
        <div className="page-title-row">
          <div>
            <div className="page-breadcrumb">{breadcrumb}</div>
            <div className="page-title">
              {title}
              {page === 'finance' && (
                <span style={{ fontSize: 12, color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                  <span className="live-dot" /> RECONCILED
                </span>
              )}
            </div>
          </div>
          {page === 'inventory' && (
            <div className="page-title-actions">
              <button className="btn btn-primary btn-sm">
                <ShoppingCart size={12} /> New Purchase Order
              </button>
            </div>
          )}
          {page === 'overview' && (
            <div className="page-title-actions">
              <span style={{ fontSize: 12, color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bot size={14} /> Master Orchestrator Active
              </span>
            </div>
          )}
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {renderPageContent()}
        </div>
      </main>
    </div>
  );
}

// Quick stats widget for overview sidebar
function QuickStats() {
  const [lowCount,  setLowCount]  = useState<number | null>(null);
  const [cashInfo,  setCashInfo]  = useState<any>(null);

  useEffect(() => {
    getLowStock().then(r => { if (r.ok) setLowCount(r.count); }).catch(() => {});
    getCashPosition().then(r => { if (r.ok) setCashInfo(r); }).catch(() => {});
  }, []);

  return (
    <>
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>Quick Actions</div>
        {[
          { icon: <AlertTriangle size={13}/>, label: 'Check low stock items' },
          { icon: <DollarSign size={13}/>,   label: 'Review cash position' },
          { icon: <ShoppingCart size={13}/>, label: 'Create purchase order' },
          { icon: <BarChart2 size={13}/>,    label: 'Show sales trends' },
        ].map(a => (
          <button key={a.label} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: 8, marginBottom: 6, fontSize: 13 }}>
            <span style={{ color: 'var(--color-accent)' }}>{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>

      {lowCount !== null && lowCount > 0 && (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.25)', borderLeft: '3px solid var(--color-amber)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <AlertTriangle size={14} color="var(--color-amber)" />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-amber)' }}>Inventory Alert</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {lowCount} item{lowCount !== 1 ? 's' : ''} below reorder threshold.
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%', gap: 6 }}>
            <ShoppingCart size={11}/> Draft Purchase Orders
          </button>
        </div>
      )}

      {cashInfo && (
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Net Cash Position</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {cashInfo.cash_balance >= 0 ? '₹' : '-₹'}{Math.abs(cashInfo.cash_balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 11, color: cashInfo.cash_balance >= 0 ? 'var(--color-green)' : 'var(--color-red)', marginTop: 4 }}>
            {cashInfo.cash_balance >= 0 ? '✓ Positive' : '⚠ Negative'}
          </div>
        </div>
      )}
    </>
  );
}

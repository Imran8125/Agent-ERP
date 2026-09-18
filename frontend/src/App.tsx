import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import { Sidebar, type Page } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatPanel } from './ChatPanel';
import { InventoryTable } from './InventoryTable';
import { ReportCharts } from './ReportCharts';
import { CustomersPage } from './pages/CustomersPage';
import { VendorsPage } from './pages/VendorsPage';
import { FinancePage } from './pages/FinancePage';
import { ActivityPage } from './pages/ActivityPage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { getPendingActions, createChatSocket, getLowStock, type ChartSpec } from './api';
import { POModal } from './components/ManualEntryModals';
import { ShoppingCart, BarChart2, Bot, Package, History, CheckCircle2, Sparkles } from 'lucide-react';

const PAGE_TITLES: Record<Page, { breadcrumb: string; title: string }> = {
  overview:   { breadcrumb: 'OPERATIONS',  title: 'Cockpit'     },
  workspaces: { breadcrumb: 'FLEET',       title: 'Workspaces'  },
  inventory:  { breadcrumb: 'INVENTORY',   title: 'Inventory'   },
  customers:  { breadcrumb: 'CRM',         title: 'Customers'   },
  vendors:    { breadcrumb: 'SUPPLIERS',   title: 'Vendors'     },
  finance:    { breadcrumb: 'LEDGER',      title: 'Finance'     },
  reports:    { breadcrumb: 'REPORTS',     title: 'Analytics'   },
  activity:   { breadcrumb: 'AUDIT',       title: 'Audit Log'   },
  settings:   { breadcrumb: 'SYSTEM',      title: 'Settings'    },
  profile:    { breadcrumb: 'ACCOUNT',     title: 'Profile'     },
};

type RightZoneTab = 'inventory' | 'reports' | 'activity';

export default function App() {
  const [page,             setPage]             = useState<Page>('overview');
  const [rightTab,         setRightTab]         = useState<RightZoneTab>('inventory');
  const [pendingCount,     setPendingCount]     = useState(0);
  const [agentInput,       setAgentInput]       = useState('');
  const [hasNotif,         setHasNotif]         = useState(false);
  const [flashItemId,      setFlashItemId]      = useState<string | undefined>();
  const [lowCount,         setLowCount]         = useState<number | null>(null);
  const [dynamicChartSpec, setDynamicChartSpec] = useState<ChartSpec | null>(null);
  const [syncPill,         setSyncPill]         = useState<string | null>(null);
  const [showPO,           setShowPO]           = useState(false);

  // Collapsible sidebar (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === '1';
    } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', sidebarCollapsed ? '1' : '0'); } catch {}
  }, [sidebarCollapsed]);

  // Resizable cockpit splitter (persisted). Clamped to keep both zones usable.
  const [leftPct, setLeftPct] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('cockpit-left-pct');
      const v = raw ? parseFloat(raw) : 55;
      return Number.isFinite(v) ? Math.min(75, Math.max(30, v)) : 55;
    } catch { return 55; }
  });
  const [isResizing, setIsResizing] = useState(false);
  const cockpitRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const applyPctFromClientX = useCallback((clientX: number) => {
    const el = cockpitRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setLeftPct(Math.min(75, Math.max(30, Math.round(pct * 10) / 10)));
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => applyPctFromClientX(e.clientX);
    const onUp = () => {
      draggingRef.current = false;
      setIsResizing(false);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) applyPctFromClientX(e.touches[0].clientX);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, applyPctFromClientX]);

  useEffect(() => {
    try { localStorage.setItem('cockpit-left-pct', String(leftPct)); } catch {}
  }, [leftPct]);

  // Poll pending actions count and inventory health
  useEffect(() => {
    const refresh = () => {
      getPendingActions()
        .then(res => setPendingCount(res.pending_actions?.length || 0))
        .catch(() => {});
      getLowStock()
        .then(res => { if (res.ok) setLowCount(res.count); })
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
          () => console.log('Agent ERP WebSocket connected'),
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

  const renderCockpit = () => {
        return (
          <div ref={cockpitRef} className={`two-col-layout${isResizing ? ' resizing' : ''}`} style={{ gridTemplateColumns: `${leftPct}% 0px 1fr` }}>
            {/* Zone 1: Autonomous AI Conversational Workspace (55%) */}
            <div className="cockpit-left-zone">
              <ChatPanel
                agentInput={agentInput}
                onAgentInputClear={() => setAgentInput('')}
                onPendingAction={() => { setPendingCount(c => c + 1); setHasNotif(true); }}
                onChartGenerated={(spec) => {
                  setDynamicChartSpec(spec);
                  setRightTab('reports');
                  setSyncPill(`Generated: ${spec.title}`);
                  setTimeout(() => setSyncPill(null), 4500);
                }}
                onDomainFocus={(domain, affectedItems) => {
                  if (domain === 'reports') {
                    setRightTab('reports');
                    setSyncPill('Focused on Analytics');
                  } else if (domain === 'inventory' || domain === 'procurement') {
                    setRightTab('inventory');
                    if (affectedItems && affectedItems.length > 0) {
                      setFlashItemId(affectedItems[0]);
                      setSyncPill(`Inventory Focused (${affectedItems.join(', ')})`);
                      setTimeout(() => setFlashItemId(undefined), 6000);
                    } else {
                      setSyncPill('Focused on Inventory');
                    }
                  } else if (domain === 'activity') {
                    setRightTab('activity');
                    setSyncPill('Focused on Audit Log');
                  }
                  setTimeout(() => setSyncPill(null), 4000);
                }}
                onActionConfirmed={(itemId) => {
                  setFlashItemId(itemId);
                  setRightTab('inventory');
                  setPendingCount(c => Math.max(0, c - 1));
                  setSyncPill('Order Cleared · Ledger Updated');
                  setTimeout(() => { setFlashItemId(undefined); setSyncPill(null); }, 4000);
                }}
              />
            </div>

            {/* Resizable splitter slider between zones */}
            <div
              className={`cockpit-splitter${isResizing ? ' active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                draggingRef.current = true;
                setIsResizing(true);
              }}
              onTouchStart={() => {
                draggingRef.current = true;
                setIsResizing(true);
              }}
              onDoubleClick={() => setLeftPct(55)}
              title={`Drag to resize panels (${Math.round(leftPct)} / ${Math.round(100 - leftPct)}). Double-click to reset.`}
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={Math.round(leftPct)}
              aria-valuemin={30}
              aria-valuemax={75}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setLeftPct(v => Math.max(30, v - 2));
                if (e.key === 'ArrowRight') setLeftPct(v => Math.min(75, v + 2));
                if (e.key === 'Home') setLeftPct(55);
              }}
            >
              <div className="cockpit-splitter-handle" />
              <span className="cockpit-splitter-label">{Math.round(leftPct)}%</span>
            </div>

            {/* Zone 2: Live ERP Context & Telemetry */}
            <div className="cockpit-right-zone">
              {/* Dynamic Auto-Sync Notification Pill */}
              {syncPill && (
                <div style={{
                  padding: '6px 12px',
                  background: 'var(--color-accent-subtle)',
                  borderBottom: '1px solid rgba(67, 56, 202, 0.15)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={12} color="var(--color-accent)" />
                    {syncPill}
                  </span>
                  <span style={{ fontSize: 9.5, opacity: 0.8, letterSpacing: '0.04em' }}>AUTO-SYNCED</span>
                </div>
              )}

              {/* Zone Tab Bar */}
              <div className="zone-tab-bar">
                <button
                  className={`zone-tab-btn ${rightTab === 'inventory' ? 'active' : ''}`}
                  onClick={() => setRightTab('inventory')}
                >
                  <Package size={13} />
                  <span>Inventory</span>
                  {flashItemId && (
                    <span className="zone-tab-badge" style={{ color: 'var(--color-accent)', background: 'var(--color-accent-subtle)', fontWeight: 700 }}>
                      SYNC
                    </span>
                  )}
                  {lowCount !== null && lowCount > 0 && !flashItemId && (
                    <span className="zone-tab-badge" style={{ color: 'var(--color-amber)', background: 'var(--color-amber-subtle)', fontWeight: 600 }}>
                      ▲ {lowCount}
                    </span>
                  )}
                </button>

                <button
                  className={`zone-tab-btn ${rightTab === 'reports' ? 'active' : ''}`}
                  onClick={() => setRightTab('reports')}
                >
                  <BarChart2 size={13} />
                  <span>Analytics</span>
                  {dynamicChartSpec ? (
                    <span className="zone-tab-badge" style={{ color: 'var(--color-accent)', background: 'var(--color-accent-subtle)', fontWeight: 700 }}>
                      NEW
                    </span>
                  ) : (
                    <span className="zone-tab-badge">30d</span>
                  )}
                </button>

                <button
                  className={`zone-tab-btn ${rightTab === 'activity' ? 'active' : ''}`}
                  onClick={() => setRightTab('activity')}
                >
                  <History size={13} />
                  <span>Audit Log</span>
                  <span className="zone-tab-badge" style={{ color: 'var(--color-green)', background: 'var(--color-green-subtle)', fontWeight: 600 }}>
                    live
                  </span>
                </button>
              </div>

              {/* Zone Content Container */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {rightTab === 'inventory' && (
                  <InventoryTable
                    flashItemId={flashItemId}
                    showKpis={false}
                    onDraftPO={(item) => setAgentInput(`@procurement Draft a purchase order for 50 units of ${item.name} (${item.sku})`)}
                  />
                )}
                {rightTab === 'reports' && <ReportCharts compact={true} dynamicChart={dynamicChartSpec} />}
                {rightTab === 'activity' && <ActivityPage />}
              </div>
            </div>
          </div>
        );
  };

  const renderOtherPages = () => {
    switch (page) {
      case 'workspaces':
        return <WorkspacesPage />;
      case 'inventory':
        return (
          <InventoryTable
            flashItemId={flashItemId}
            showKpis={true}
            onDraftPO={(item) => {
              setAgentInput(`@procurement Draft a purchase order for 50 units of ${item.name} (${item.sku})`);
              setPage('overview');
            }}
          />
        );
      case 'customers':
        return <CustomersPage />;
      case 'vendors':
        return <VendorsPage />;
      case 'finance':
        return <FinancePage />;
      case 'reports':
        return (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <ReportCharts compact={false} dynamicChart={dynamicChartSpec} />
          </div>
        );
      case 'activity':
        return <ActivityPage />;
      case 'settings':
        return <SettingsPage />;
      case 'profile':
        return <ProfilePage />;
    }
  };

  return (
    <div className={`app-layout${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <Header
        current={page}
        onChange={setPage}
        hasNotif={hasNotif}
      />
      <Sidebar
        current={page}
        onChange={setPage}
        pendingCount={pendingCount}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
      />
      <main className="app-main main-content">
        {/* Page title bar */}
        <div className="page-title-row">
          <div>
            <div className="page-breadcrumb">{breadcrumb}</div>
            <div className="page-title">
              {title}
              {page === 'finance' && (
                <span style={{ fontSize: 12, color: 'var(--color-green)', display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                  <CheckCircle2 size={13} /> RECONCILED
                </span>
              )}
            </div>
          </div>
          {page === 'inventory' && (
            <div className="page-title-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowPO(true)}
              >
                <ShoppingCart size={12} /> New Order
              </button>
            </div>
          )}
          {page === 'overview' && (
            <div className="page-title-actions">
              <span style={{ fontSize: 12, color: 'var(--color-green)', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                <span className="live-dot" />
                <Bot size={13} /> Master Orchestrator Active
              </span>
            </div>
          )}
        </div>

        {/* Page content — cockpit stays mounted (hidden) so the PO draft
            conversation + cards never lose state when navigating pages. */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0, display: page === 'overview' ? 'flex' : 'none', flexDirection: 'column' }}>
            {renderCockpit()}
          </div>
          {page !== 'overview' && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {renderOtherPages()}
            </div>
          )}
        </div>
        {showPO && <POModal onClose={() => setShowPO(false)} onSaved={() => {}} />}
      </main>
    </div>
  );
}

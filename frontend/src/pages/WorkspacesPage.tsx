import { useState, useEffect } from 'react';
import {
  Bot, CheckCircle2,
  RefreshCw, Plus, ArrowRight,
  Radio, X
} from 'lucide-react';
import {
  getWorkspaces,
  createWorkspace,
  switchWorkspace as apiSwitchWorkspace,
  getFleetAgents,
  type Workspace,
  type FleetAgent,
} from '../api';

// Single-workspace mode: only the canonical production workspace from the
// database is ever rendered. Legacy mock / test workspaces are filtered out
// here so they can never reappear on this page.
const CANONICAL_WORKSPACE_ID = 'ws-prd-0982-inr';

function onlyCanonicalWorkspaces(list: Workspace[]): Workspace[] {
  if (list.some(w => w.id === CANONICAL_WORKSPACE_ID)) {
    return list.filter(w => w.id === CANONICAL_WORKSPACE_ID);
  }
  return list;
}

export function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [fleetAgents, setFleetAgents] = useState<FleetAgent[]>([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsCurrency, setNewWsCurrency] = useState('USD');

  const refreshData = async () => {
    setFleetLoading(true);
    try {
      const [wsRes, fleetRes] = await Promise.all([
        getWorkspaces(),
        getFleetAgents(),
      ]);
      if (wsRes.ok && wsRes.workspaces) {
        setWorkspaces(onlyCanonicalWorkspaces(wsRes.workspaces));
      }
      if (fleetRes.ok && fleetRes.fleet) {
        setFleetAgents(fleetRes.fleet);
      }
    } catch (e) {
      console.error('Failed to load workspaces or fleet:', e);
    } finally {
      setFleetLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const switchWorkspace = async (id: string) => {
    try {
      const res = await apiSwitchWorkspace(id);
      if (res.ok) {
        setWorkspaces(prev =>
          prev.map(w => ({
            ...w,
            active: w.id === id,
          }))
        );
      }
    } catch (e) {
      console.error('Failed to switch workspace:', e);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await refreshData();
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      const res = await createWorkspace({
        name: newWsName.trim(),
        currency: newWsCurrency,
        env: 'Staging',
      });
      if (res.ok && res.workspace) {
        setWorkspaces(prev => onlyCanonicalWorkspaces([...prev, res.workspace]));
      }
    } catch (e) {
      console.error('Failed to create workspace:', e);
    }
    setNewWsName('');
    setShowModal(false);
  };

  return (
    <div className="workspaces-page page-container" style={{ padding: '24px', overflowY: 'auto' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
            Workspaces
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
            Manage ledger workspaces and specialist agent fleet.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSync}
            disabled={isSyncing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} className={isSyncing ? 'spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Fleet'}</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} />
            <span>New Workspace</span>
          </button>
        </div>
      </div>

      {/* Workspace Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 32 }}>
        {workspaces.map(ws => (
          <div
            key={ws.id}
            className="workspace-card"
            style={{
              background: 'var(--color-surface)',
              border: ws.active ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              position: 'relative',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>
                    {ws.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: ws.env === 'Production' ? 'var(--color-green-subtle)' : 'var(--color-surface-subtle)',
                      color: ws.env === 'Production' ? 'var(--color-green)' : 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {ws.env}
                  </span>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {ws.id} · {ws.code}
                </div>
              </div>
              {ws.active ? (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-accent)',
                    background: 'var(--color-accent-subtle)',
                    padding: '3px 8px',
                    borderRadius: 999,
                  }}
                >
                  <CheckCircle2 size={12} /> Active
                </span>
              ) : (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => switchWorkspace(ws.id)}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  Switch <ArrowRight size={11} style={{ marginLeft: 4 }} />
                </button>
              )}
            </div>

            {/* Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                padding: '12px',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Compute</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginTop: 2 }}>
                  {ws.compute}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Agents</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginTop: 2 }}>
                  {ws.agents}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Currency</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginTop: 2 }}>
                  {ws.currency} ({ws.symbol})
                </div>
              </div>
            </div>

            {/* Footer row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>Catalog: {ws.skus.toLocaleString()} SKUs</span>
              <span>Synced {ws.lastSync}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Agent Fleet Table */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>
              Active Fleet
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Specialist agents deployed on current workspace.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-green)' }}>
            <span className="live-dot" />
            <span style={{ fontWeight: 500 }}>All Agents Operational</span>
          </div>
        </div>

        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 18px' }}>Agent</th>
              <th style={{ textAlign: 'left', padding: '10px 14px' }}>Role</th>
              <th style={{ textAlign: 'left', padding: '10px 14px' }}>Model</th>
              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Latency</th>
              <th style={{ textAlign: 'right', padding: '10px 14px' }}>24h Tasks</th>
              <th style={{ textAlign: 'center', padding: '10px 18px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {fleetLoading && fleetAgents.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Loading live fleet telemetry…
                </td>
              </tr>
            )}
            {!fleetLoading && fleetAgents.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  No fleet telemetry available. Check backend connectivity and retry Sync Fleet.
                </td>
              </tr>
            )}
            {fleetAgents.map(agent => (
              <tr key={agent.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: '12px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-accent-subtle)',
                        color: 'var(--color-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Bot size={15} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text)' }}>
                        {agent.name}
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                        {agent.id}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {agent.role}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      background: 'var(--color-surface-subtle)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      color: 'var(--color-text)',
                    }}
                  >
                    {agent.model}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text)' }}>
                  {agent.latency}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text)' }}>
                  {agent.tasks24h.toLocaleString()}
                </td>
                <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background:
                        agent.status === 'active'
                          ? 'var(--color-green-subtle)'
                          : agent.status === 'streaming'
                          ? 'var(--color-accent-subtle)'
                          : 'var(--color-surface-subtle)',
                      color:
                        agent.status === 'active'
                          ? 'var(--color-green)'
                          : agent.status === 'streaming'
                          ? 'var(--color-accent)'
                          : 'var(--color-text-muted)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {agent.status === 'streaming' ? <Radio size={10} className="spin" /> : '●'} {agent.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Workspace Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              width: 420,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>New Workspace</div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  Workspace Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. EU Operations Hub"
                  value={newWsName}
                  onChange={e => setNewWsName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                  Base Currency
                </label>
                <select
                  value={newWsCurrency}
                  onChange={e => setNewWsCurrency(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    background: 'var(--color-surface)',
                  }}
                >
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

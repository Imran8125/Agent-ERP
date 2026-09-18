import { Bell, Search, Sparkles } from 'lucide-react';
import type { Page } from './Sidebar';
import { useProfile, profileInitials } from '../profile';

interface HeaderProps {
  current: Page;
  onChange: (p: Page) => void;
  hasNotif: boolean;
}

const TOP_TABS: { id: Page; label: string }[] = [
  { id: 'overview',   label: 'Cockpit' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'inventory',  label: 'Inventory' },
  { id: 'reports',    label: 'Analytics' },
  { id: 'activity',   label: 'Audit Log' },
  { id: 'settings',   label: 'Settings' },
];

export function Header({ current, onChange, hasNotif }: HeaderProps) {
  const profile = useProfile();
  return (
    <header className="header app-header">
      <div className="header-brand">
        <div className="header-logo-text" onClick={() => onChange('overview')} style={{ cursor: 'pointer' }}>
          <span className="header-logo-badge">ERP</span>
          <span>Agent ERP</span>
        </div>
        <div className="system-status-pill">
          <span className="live-dot" />
          <span>5 Agents Active</span>
        </div>
      </div>

      {/* Top Nav Tabs matching Stitch */}
      <nav className="header-tabs" style={{ display: 'flex', gap: 4, margin: '0 16px' }}>
        {TOP_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              background: current === tab.id ? 'var(--color-surface-subtle)' : 'transparent',
              color: current === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: current === tab.id ? 600 : 500,
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="header-search">
        <Search size={14} className="header-search-icon" />
        <input
          placeholder="Ask anything or type ⌘K..."
          readOnly
          onClick={() => onChange('overview')}
        />
        <span className="header-search-badge">⌘K</span>
      </div>

      <div className="header-actions">
        <div className="session-tag" onClick={() => onChange('workspaces')} style={{ cursor: 'pointer' }}>
          <Sparkles size={12} color="var(--color-accent)" />
          <span>Main Ledger #04</span>
        </div>
        <button className="header-notif-btn" title="Notifications" onClick={() => onChange('activity')}>
          <Bell size={15} />
          {hasNotif && <span className="header-notif-dot" />}
        </button>
        <div className="sidebar-user-avatar" title={`${profile.name} — View profile`} onClick={() => onChange('profile')} style={{ cursor: 'pointer' }}>
          {profileInitials(profile.name)}
        </div>
      </div>
    </header>
  );
}

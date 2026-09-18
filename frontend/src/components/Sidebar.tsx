import type { ReactNode } from 'react';
import {
  LayoutDashboard, Server, Package, Users, Truck,
  TrendingUp, Activity, CreditCard, Settings, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { useProfile, profileInitials } from '../profile';

type Page =
  | 'overview'
  | 'workspaces'
  | 'inventory'
  | 'customers'
  | 'vendors'
  | 'finance'
  | 'reports'
  | 'activity'
  | 'settings'
  | 'profile';

interface SidebarProps {
  current: Page;
  onChange: (p: Page) => void;
  pendingCount: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

const NAV_ITEMS: { id: Page; label: string; icon: ReactNode; breadcrumb: string }[] = [
  { id: 'overview',   label: 'Cockpit',    icon: <LayoutDashboard size={15}/>, breadcrumb: 'OPERATIONS' },
  { id: 'workspaces', label: 'Workspaces', icon: <Server size={15}/>,          breadcrumb: 'FLEET' },
  { id: 'inventory',  label: 'Inventory',  icon: <Package size={15}/>,         breadcrumb: 'INVENTORY' },
  { id: 'customers',  label: 'Customers',  icon: <Users size={15}/>,           breadcrumb: 'CRM' },
  { id: 'vendors',    label: 'Vendors',    icon: <Truck size={15}/>,           breadcrumb: 'SUPPLIERS' },
  { id: 'finance',    label: 'Finance',    icon: <CreditCard size={15}/>,      breadcrumb: 'LEDGER' },
  { id: 'reports',    label: 'Analytics',  icon: <TrendingUp size={15}/>,      breadcrumb: 'REPORTS' },
  { id: 'activity',   label: 'Audit Log',  icon: <Activity size={15}/>,        breadcrumb: 'AUDIT' },
  { id: 'settings',   label: 'Settings',   icon: <Settings size={15}/>,        breadcrumb: 'SYSTEM' },
];

export function Sidebar({ current, onChange, pendingCount, collapsed = false, onToggle }: SidebarProps) {
  const profile = useProfile();
  return (
    <aside className={`sidebar app-sidebar${collapsed ? ' collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronsRight size={15}/> : <ChevronsLeft size={15}/>}
        {!collapsed && <span>Command Center</span>}
      </button>

      {!collapsed && <p className="sidebar-section-label">Command Center</p>}

      <nav className="sidebar-nav" aria-label="Primary">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${current === item.id ? 'active' : ''}`}
            onClick={() => onChange(item.id)}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            aria-current={current === item.id ? 'page' : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
            {item.id === 'activity' && pendingCount > 0 && !collapsed && (
              <span className="sidebar-badge">{pendingCount}</span>
            )}
            {item.id === 'activity' && pendingCount > 0 && collapsed && (
              <span className="sidebar-dot" aria-hidden="true" />
            )}
          </button>
        ))}
      </nav>

      <div
        className="sidebar-user"
        onClick={() => onChange('profile')}
        title={collapsed ? `${profile.name} — View profile` : 'View profile'}
        style={{ cursor: 'pointer' }}
      >
        <div className="sidebar-user-avatar">{profileInitials(profile.name)}</div>
        {!collapsed && (
          <div>
            <div className="sidebar-user-name">{profile.name}</div>
            <div className="sidebar-user-role">{profile.role}</div>
          </div>
        )}
      </div>
    </aside>
  );
}

export { NAV_ITEMS };
export type { Page };

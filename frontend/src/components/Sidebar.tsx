import type { ReactNode } from 'react';
import {
  LayoutDashboard, Package, Users, TrendingUp, Activity,
  CreditCard
} from 'lucide-react';

type Page = 'overview' | 'inventory' | 'customers' | 'finance' | 'reports' | 'activity';

interface SidebarProps {
  current: Page;
  onChange: (p: Page) => void;
  pendingCount: number;
}

const NAV_ITEMS: { id: Page; label: string; icon: ReactNode; breadcrumb: string }[] = [
  { id: 'overview',   label: 'Overview',         icon: <LayoutDashboard size={16}/>, breadcrumb: 'Operations Overview' },
  { id: 'inventory',  label: 'Inventory',         icon: <Package size={16}/>,        breadcrumb: 'Inventory Management' },
  { id: 'customers',  label: 'Customers',         icon: <Users size={16}/>,          breadcrumb: 'Customer Relations' },
  { id: 'finance',    label: 'Finance',           icon: <CreditCard size={16}/>,     breadcrumb: 'Finance & Accounting' },
  { id: 'reports',    label: 'Reports',           icon: <TrendingUp size={16}/>,     breadcrumb: 'Business Analytics' },
  { id: 'activity',   label: 'Activity / Audit Log', icon: <Activity size={16}/>,   breadcrumb: 'Audit Log' },
];

export function Sidebar({ current, onChange, pendingCount }: SidebarProps) {
  return (
    <aside className="sidebar app-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">Agent ERP</div>
        <div className="sidebar-logo-sub">Autonomous Ops</div>
      </div>

      <p className="sidebar-section-label">Navigation</p>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${current === item.id ? 'active' : ''}`}
            onClick={() => onChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.id === 'activity' && pendingCount > 0 && (
              <span className="sidebar-badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">AD</div>
        <div>
          <div className="sidebar-user-name">Alex Dev</div>
          <div className="sidebar-user-role">Operations Lead</div>
        </div>
      </div>
    </aside>
  );
}

export { NAV_ITEMS };
export type { Page };

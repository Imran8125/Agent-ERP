import { Bell, Search } from 'lucide-react';

interface HeaderProps {
  onAgentClick: (agent: string) => void;
  hasNotif: boolean;
}

const AGENTS = [
  { tag: '@procurement', label: '@procurement' },
  { tag: '@inventory',   label: '@inventory'   },
  { tag: '@finance',     label: '@finance'      },
  { tag: '@crm',         label: '@crm'          },
  { tag: '@reporting',   label: '@reporting'    },
];

export function Header({ onAgentClick, hasNotif }: HeaderProps) {
  return (
    <header className="header app-header">
      <div className="header-search">
        <Search size={14} className="header-search-icon" />
        <input placeholder="Search entities, SKUs, or type @agent…" readOnly
          onClick={() => {}}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 4 }}>Agents:</span>
        <div className="agent-chips">
          {AGENTS.map(a => (
            <button
              key={a.tag}
              className="agent-chip"
              onClick={() => onAgentClick(a.tag + ' ')}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="header-actions">
        <button className="header-notif-btn">
          <Bell size={15} />
          {hasNotif && <span className="header-notif-dot" />}
        </button>
        <div className="sidebar-user-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>AD</div>
      </div>
    </header>
  );
}

import { useState, useEffect } from 'react';
import {
  MessageSquare, Plus, Search, Trash2, Clock, Bot,
  ShoppingCart, Package, DollarSign, Users, BarChart2, X
} from 'lucide-react';
import { getConversations, deleteConversation, timeAgo, type Conversation } from '../api';

interface ConversationDrawerProps {
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const AGENT_ICONS: Record<string, any> = {
  procurement: <ShoppingCart size={11} color="#4338CA" />,
  inventory:   <Package size={11} color="#0284C7" />,
  finance:     <DollarSign size={11} color="#059669" />,
  crm:         <Users size={11} color="#7C3AED" />,
  reporting:   <BarChart2 size={11} color="#D97706" />,
  master:      <Bot size={11} color="#0F172A" />,
};

export function ConversationDrawer({
  activeId,
  onSelect,
  onNewChat,
  isOpen,
  onClose,
}: ConversationDrawerProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await getConversations();
      if (res.ok) {
        setConversations(res.conversations || []);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchList();
    }
  }, [isOpen]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeId === id) {
        onNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  const filtered = conversations.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 290,
        background: '#FFFFFF',
        borderRight: '1px solid var(--color-border)',
        boxShadow: '4px 0 24px rgba(15, 23, 42, 0.08)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInLeft 0.18s ease-out',
      }}
    >
      {/* Drawer Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--color-bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={15} color="var(--color-accent)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Session History
          </span>
        </div>
        <button
          className="btn btn-icon btn-sm"
          onClick={onClose}
          style={{ width: 24, height: 24, padding: 0 }}
          title="Close History"
        >
          <X size={14} />
        </button>
      </div>

      {/* Action: New Session */}
      <div style={{ padding: '12px 14px 8px 14px' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            onNewChat();
            onClose();
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 12px',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <Plus size={14} />
          <span>New Chat Session</span>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '4px 14px 10px 14px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search past conversations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 28, fontSize: 11.5, height: 30 }}
          />
        </div>
      </div>

      {/* List of sessions */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 14px 8px' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 }}>
            <div className="spinner" />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Loading sessions…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 12 }}>
            {search ? 'No matching conversations' : 'No recorded conversation history yet. Start a session!'}
          </div>
        )}

        {!loading && filtered.map(c => {
          const isActive = c.id === activeId;
          const agentKey = (c.active_agent || 'master').replace('_agent', '');
          const icon = AGENT_ICONS[agentKey] || AGENT_ICONS.master;

          return (
            <div
              key={c.id}
              onClick={() => {
                onSelect(c.id);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '9px 10px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                marginBottom: 3,
                background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                border: isActive ? '1px solid var(--color-accent)' : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-subtle)';
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <div style={{
                marginTop: 2,
                width: 20,
                height: 20,
                borderRadius: 4,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--color-accent)' : 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {c.title || 'Untitled Conversation'}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10.5,
                  color: 'var(--text-tertiary)',
                  marginTop: 3,
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={10} /> {timeAgo(c.updated_at)}
                  </span>
                  <span>·</span>
                  <span>{c.message_count} {c.message_count === 1 ? 'msg' : 'msgs'}</span>
                </div>
              </div>

              <button
                className="btn btn-icon btn-sm"
                onClick={(e) => handleDelete(e, c.id)}
                title="Delete session"
                style={{
                  width: 22,
                  height: 22,
                  padding: 0,
                  color: 'var(--text-tertiary)',
                  opacity: 0.6,
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.color = 'var(--color-red)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '0.6';
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConversationDrawer;

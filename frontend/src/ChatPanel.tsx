import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Bot, User, Package, ShoppingCart, DollarSign, Users, BarChart2 } from 'lucide-react';
import { ChatComposer } from './components/ChatComposer';
import { ConfirmationCard } from './ConfirmationCard';
import { sendChat } from './api';
import type { ChatMessage } from './api';

interface ChatPanelProps {
  agentInput: string;
  onAgentInputClear: () => void;
  onPendingAction: (id: string) => void;
}

const AGENT_META: Record<string, { label: string; icon: ReactNode; color: string }> = {
  procurement_agent: { label: 'Procurement', icon: <ShoppingCart size={12}/>, color: '#f59e0b' },
  inventory_agent:   { label: 'Inventory',   icon: <Package size={12}/>,       color: '#3b82f6' },
  finance_agent:     { label: 'Finance',     icon: <DollarSign size={12}/>,    color: '#22c55e' },
  crm_agent:         { label: 'CRM',         icon: <Users size={12}/>,         color: '#a855f7' },
  reporting_agent:   { label: 'Reporting',   icon: <BarChart2 size={12}/>,     color: '#6366f1' },
  master:            { label: 'Orchestrator',icon: <Bot size={12}/>,           color: '#6366f1' },
};

const SUGGESTIONS = [
  'Show me all low stock items',
  'What\'s our current cash position?',
  '@procurement Create a PO for 20 industrial filters',
  'Show me top customers by revenue',
  'Who are our customers?',
  '@reporting Show me sales trend for the last 30 days',
];

type Msg = ChatMessage & {
  id: string;
  timestamp: string;
  agent?: string;
  pending_action_id?: string;
  tool_results?: any[];
  is_proactive?: boolean;
};

export function ChatPanel({ agentInput, onAgentInputClear, onPendingAction }: ChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sync external agent input (from header chips)
  useEffect(() => {
    if (agentInput) {
      setInput(prev => prev + agentInput);
      onAgentInputClear();
    }
  }, [agentInput]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Msg = {
      id:        Date.now().toString(),
      role:      'user',
      content:   text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await sendChat(text, history);

      const agentMsg: Msg = {
        id:                Date.now().toString() + '_a',
        role:              'assistant',
        content:           res.content || '',
        agent:             res.agent || res.routed_to || 'master',
        pending_action_id: res.pending_action_id,
        tool_results:      res.tool_results,
        timestamp:         new Date().toISOString(),
      };
      setMessages(prev => [...prev, agentMsg]);

      if (res.pending_action_id) {
        onPendingAction(res.pending_action_id);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        role: 'assistant',
        content: `⚠️ Error: ${e.message || 'Could not reach backend'}`,
        agent: 'master',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (content: string) => {
    // Basic markdown parsing
    const lines = content.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i}><strong>{line.slice(2,-2)}</strong></p>;
      }
      if (line.startsWith('# '))  return <p key={i} style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{line.slice(2)}</p>;
      if (line.startsWith('## ')) return <p key={i} style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{line.slice(3)}</p>;
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 2 }}>
          <span style={{ color: 'var(--color-accent)', marginTop: 3, flexShrink: 0 }}>▪</span>
          <span>{formatLine(line.slice(2))}</span>
        </div>;
      }
      if (!line.trim()) return <br key={i}/>;
      return <p key={i}>{formatLine(line)}</p>;
    });
  };

  const formatLine = (text: string) => {
    // Bold (**text**) and backticks
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**'))
        return <strong key={i}>{p.slice(2,-2)}</strong>;
      if (p.startsWith('`') && p.endsWith('`'))
        return <code key={i} style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3, fontSize: '0.9em', fontFamily: 'monospace' }}>{p.slice(1,-1)}</code>;
      return p;
    });
  };

  if (messages.length === 0) {
    return (
      <div className="chat-panel">
        <div className="chat-messages">
          <div className="chat-empty">
            <div style={{ fontSize: 36 }}>🤖</div>
            <div>
              <div className="chat-empty-title">AgentERP Orchestrator</div>
              <div className="chat-empty-sub" style={{ marginTop: 6 }}>
                Your AI-first ERP. Talk naturally or use @tags to route to specific agents.
              </div>
            </div>
            <div className="chat-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="chat-suggestion" onClick={() => { setInput(s); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ChatComposer value={input} onChange={setInput} onSend={send} disabled={loading} />
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map(msg => {
          const meta = AGENT_META[msg.agent || 'master'] || AGENT_META.master;

          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="msg-row user">
                <div className="msg-avatar user"><User size={13}/></div>
                <div className="msg-content">
                  <div className="msg-meta">
                    <span style={{ fontSize: 11 }}>You</span>
                  </div>
                  <div className="msg-bubble user">{msg.content}</div>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id}>
              <div className={`msg-row`}>
                <div className="msg-avatar agent" style={{ background: meta.color }}>
                  {meta.icon}
                </div>
                <div className="msg-content">
                  <div className="msg-meta">
                    <span className="msg-agent-label" style={{ color: meta.color }}>{meta.label}</span>
                    <span>·</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  {msg.content && (
                    <div className={`msg-bubble agent ${msg.is_proactive ? 'proactive' : ''}`}>
                      {renderContent(msg.content)}
                    </div>
                  )}

                  {/* Confirmation Card inline */}
                  {msg.pending_action_id && (
                    <div style={{ marginTop: 10 }}>
                      <ConfirmationCard
                        pendingActionId={msg.pending_action_id}
                        onConfirmed={() => onPendingAction(msg.pending_action_id!)}
                        onRejected={() => {}}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="msg-row">
            <div className="msg-avatar agent"><Bot size={13}/></div>
            <div className="msg-content">
              <div className="msg-bubble agent">
                <div className="typing-indicator">
                  <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
      <ChatComposer value={input} onChange={setInput} onSend={send} disabled={loading} />
    </div>
  );
}

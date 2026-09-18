import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  Bot, User, Package, ShoppingCart, DollarSign, Users,
  BarChart2, Sparkles, History, Plus
} from 'lucide-react';
import { ChatComposer } from './components/ChatComposer';
import { ConfirmationCard } from './ConfirmationCard';
import { PODraftCard } from './components/PODraftCard';
import { ConversationDrawer } from './components/ConversationDrawer';
import { sendChat, getConversation, type ChatMessage, type ChartSpec } from './api';

interface ChatPanelProps {
  agentInput: string;
  onAgentInputClear: () => void;
  onPendingAction: (id: string) => void;
  onActionConfirmed?: (itemId?: string) => void;
  onChartGenerated?: (chartSpec: ChartSpec) => void;
  onDomainFocus?: (domain: string, affectedItems?: string[]) => void;
}

const AGENT_META: Record<string, { label: string; icon: ReactNode; color: string; bg: string }> = {
  procurement_agent: { label: 'Procurement Agent', icon: <ShoppingCart size={13}/>, color: '#4338CA', bg: '#EEF2FF' },
  inventory_agent:   { label: 'Inventory Agent',   icon: <Package size={13}/>,       color: '#0284C7', bg: '#F0F9FF' },
  finance_agent:     { label: 'Finance Agent',     icon: <DollarSign size={13}/>,    color: '#059669', bg: '#ECFDF5' },
  crm_agent:         { label: 'CRM Agent',         icon: <Users size={13}/>,         color: '#7C3AED', bg: '#F5F3FF' },
  reporting_agent:   { label: 'Reporting Agent',   icon: <BarChart2 size={13}/>,     color: '#D97706', bg: '#FFFBEB' },
  master:            { label: 'Master Orchestrator', icon: <Bot size={13}/>,         color: '#0F172A', bg: '#F1F5F9' },
};

const SUGGESTIONS = [
  'Show me all low stock items',
  'What is our current cash position?',
  '@procurement Order 200 industrial filters from Acme Supplies',
  'Show top customers by revenue volume',
  '@reporting Generate 30-day sales trend report',
  'Who are our active vendors and customers?',
];

type Msg = ChatMessage & {
  id: string;
  timestamp: string;
  agent?: string;
  pending_action_id?: string;
  tool_results?: any[];
  is_proactive?: boolean;
  metadata?: any;
};

export function ChatPanel({
  agentInput,
  onAgentInputClear,
  onPendingAction,
  onActionConfirmed,
  onChartGenerated,
  onDomainFocus,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversationTitle, setConversationTitle] = useState<string | undefined>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sync external agent input (from header or shortcut)
  useEffect(() => {
    if (agentInput) {
      setInput(prev => (prev ? `${prev} ${agentInput}` : agentInput));
      onAgentInputClear();
    }
  }, [agentInput]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadConversationSession = async (id: string) => {
    try {
      const res = await getConversation(id);
      if (res.ok) {
        setConversationId(res.conversation.id);
        setConversationTitle(res.conversation.title);
        const msgs: Msg[] = (res.messages || []).map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          agent: m.agent,
          pending_action_id: m.pending_action_id,
          timestamp: m.created_at,
          metadata: m.metadata,
          tool_results: m.metadata?.tool_results,
        }));
        setMessages(msgs);

        // Check if last message had chart_spec or domain_focus
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg?.metadata?.chart_spec) {
          onChartGenerated?.(lastMsg.metadata.chart_spec);
        }
        if (lastMsg?.metadata?.domain_focus) {
          onDomainFocus?.(lastMsg.metadata.domain_focus, lastMsg.metadata.affected_items);
        }
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const startNewChat = () => {
    setConversationId(undefined);
    setConversationTitle(undefined);
    setMessages([]);
  };

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
      const res = await sendChat(text, history, conversationId);

      if (res.conversation_id) {
        setConversationId(res.conversation_id);
        if (!conversationTitle) {
          const firstWord = text.replace(/^@\w+\s*/, '').slice(0, 30);
          setConversationTitle(firstWord + (firstWord.length >= 30 ? '…' : ''));
        }
      }

      const agentMsg: Msg = {
        id:                Date.now().toString() + '_a',
        role:              'assistant',
        content:           res.content || '',
        agent:             res.agent || res.routed_to || 'master',
        pending_action_id: res.pending_action_id,
        tool_results:      res.tool_results,
        metadata: {
          chart_spec:     res.chart_spec,
          domain_focus:   res.domain_focus,
          affected_items: res.affected_items,
        },
        timestamp:         new Date().toISOString(),
      };
      setMessages(prev => [...prev, agentMsg]);

      // Fire dynamic synchronization callbacks
      if (res.chart_spec) {
        onChartGenerated?.(res.chart_spec);
      }
      if (res.domain_focus) {
        onDomainFocus?.(res.domain_focus, res.affected_items);
      }
      if (res.pending_action_id) {
        onPendingAction(res.pending_action_id);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        role: 'assistant',
        content: `Error: ${e.message || 'Could not reach backend service.'}`,
        agent: 'master',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**'))
        return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (p.startsWith('*') && p.endsWith('*') && p.length > 2)
        return <em key={i}>{p.slice(1, -1)}</em>;
      if (p.startsWith('`') && p.endsWith('`'))
        return <code key={i} className="mono-data" style={{ background: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)', padding: '1px 5px', borderRadius: 3, fontSize: '0.9em' }}>{p.slice(1, -1)}</code>;
      return p;
    });
  };

  const renderContent = (content: string) => {
    const lines = content.split('\n');
    type TableBlock = {
      type: 'table';
      headers: string[];
      alignments: ('left' | 'right' | 'center')[];
      rows: string[][];
    };
    type TextBlock = {
      type: 'text';
      lines: string[];
    };
    type Block = TableBlock | TextBlock;

    const isTableRow = (l: string) => {
      const trimmed = l.trim();
      return trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.split('|').filter(Boolean).length >= 2);
    };

    const isSeparatorRow = (l: string) => {
      const trimmed = l.trim();
      if (!trimmed.includes('|') && !trimmed.includes('-')) return false;
      const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
      return parts.length > 0 && parts.every(p => /^:?-+:?$/.test(p));
    };

    const blocks: Block[] = [];
    let currentTextLines: string[] = [];

    let idx = 0;
    while (idx < lines.length) {
      const line = lines[idx];
      // Check if this line is header and next is separator
      if (isTableRow(line) && idx + 1 < lines.length && isSeparatorRow(lines[idx + 1])) {
        if (currentTextLines.length > 0) {
          blocks.push({ type: 'text', lines: currentTextLines });
          currentTextLines = [];
        }

        const rawHeader = line.split('|').map(c => c.trim());
        if (line.trim().startsWith('|') && rawHeader[0] === '') rawHeader.shift();
        if (line.trim().endsWith('|') && rawHeader[rawHeader.length - 1] === '') rawHeader.pop();

        const sepParts = lines[idx + 1].split('|').map(c => c.trim()).filter(Boolean);
        const alignments: ('left' | 'right' | 'center')[] = sepParts.map(part => {
          const hasLeft = part.startsWith(':');
          const hasRight = part.endsWith(':');
          if (hasLeft && hasRight) return 'center';
          if (hasRight) return 'right';
          return 'left';
        });

        idx += 2;
        const rows: string[][] = [];
        while (idx < lines.length && isTableRow(lines[idx]) && !isSeparatorRow(lines[idx])) {
          const rowLine = lines[idx];
          const rawRow = rowLine.split('|').map(c => c.trim());
          if (rowLine.trim().startsWith('|') && rawRow[0] === '') rawRow.shift();
          if (rowLine.trim().endsWith('|') && rawRow[rawRow.length - 1] === '') rawRow.pop();
          rows.push(rawRow);
          idx++;
        }

        blocks.push({
          type: 'table',
          headers: rawHeader,
          alignments,
          rows,
        });
      } else {
        currentTextLines.push(line);
        idx++;
      }
    }

    if (currentTextLines.length > 0) {
      blocks.push({ type: 'text', lines: currentTextLines });
    }

    return blocks.map((block, bIdx) => {
      if (block.type === 'table') {
        return (
          <div key={`table-${bIdx}`} className="chat-table-wrapper">
            <table className="chat-markdown-table">
              <thead>
                <tr>
                  {block.headers.map((h, hIdx) => {
                    const align = block.alignments[hIdx] || 'left';
                    return (
                      <th key={hIdx} className={`align-${align}`}>
                        {formatInline(h)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => {
                      const isNumeric = /^[₹$€£]?\s*-?[\d,]+(\.\d+)?%?$/.test(cell.trim());
                      const align = block.alignments[cIdx] || (isNumeric ? 'right' : 'left');
                      return (
                        <td key={cIdx} className={`align-${align} ${isNumeric ? 'mono-data' : ''}`}>
                          {formatInline(cell)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      // Text block rendering
      return (
        <div key={`text-${bIdx}`}>
          {block.lines.map((line, lIdx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('### ')) {
              return <p key={lIdx} style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 2px', color: 'var(--text-primary)' }}>{line.slice(4)}</p>;
            }
            if (trimmed.startsWith('## ')) {
              return <p key={lIdx} style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 3px', color: 'var(--text-primary)' }}>{line.slice(3)}</p>;
            }
            if (trimmed.startsWith('# ')) {
              return <p key={lIdx} style={{ fontSize: 15, fontWeight: 800, margin: '10px 0 4px', color: 'var(--text-primary)' }}>{line.slice(2)}</p>;
            }
            if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
              return <p key={lIdx} style={{ fontWeight: 600, margin: '4px 0' }}>{trimmed.slice(2, -2)}</p>;
            }
            if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
              return (
                <div key={lIdx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', margin: '2px 0' }}>
                  <span style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: 1 }}>▪</span>
                  <span>{formatInline(trimmed.slice(2))}</span>
                </div>
              );
            }
            const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
            if (numberedMatch) {
              return (
                <div key={lIdx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', margin: '2px 0' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-accent)', flexShrink: 0, minWidth: 16 }}>{numberedMatch[1]}.</span>
                  <span>{formatInline(numberedMatch[2])}</span>
                </div>
              );
            }
            if (!trimmed) {
              return <div key={lIdx} style={{ height: 6 }} />;
            }
            return <p key={lIdx} style={{ margin: '2px 0' }}>{formatInline(line)}</p>;
          })}
        </div>
      );
    });
  };

  return (
    <div className="chat-panel" style={{ position: 'relative' }}>
      {/* History Drawer */}
      <ConversationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeId={conversationId}
        onSelect={loadConversationSession}
        onNewChat={startNewChat}
      />

      {/* Header bar of chat */}
      <div className="chat-stream-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsDrawerOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 8px',
              fontSize: 11.5,
              fontWeight: 600,
              background: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
            }}
            title="Open Conversation History"
          >
            <History size={12} color="var(--color-accent)" />
            <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {conversationTitle || 'Session History'}
            </span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={startNewChat}
            style={{ padding: '3px 6px', fontSize: 11 }}
            title="Start New Conversation"
          >
            <Plus size={12} />
          </button>

          <span className="live-dot" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Specialists:</span>
          {Object.entries(AGENT_META).slice(0, 5).map(([key, a]) => (
            <span
              key={key}
              title={a.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: 3,
                background: a.bg,
                color: a.color,
                fontSize: 10,
              }}
            >
              {a.icon}
            </span>
          ))}
        </div>
      </div>

      {/* Message feed */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Bot size={22} />
            </div>
            <div className="chat-empty-title">Agent ERP Operational Cockpit</div>
            <div className="chat-empty-desc">
              Interact directly through natural language. Request stock checks, place purchase orders, review cash positions, or tag specialists with @tags.
            </div>

            <div className="chat-suggestions-grid">
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  className="chat-suggestion-chip"
                  onClick={() => setInput(s)}
                >
                  <Sparkles size={12} color="var(--color-accent)" style={{ flexShrink: 0 }} />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const meta = AGENT_META[msg.agent || 'master'] || AGENT_META.master;

            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="chat-msg user">
                  <div className="chat-msg-avatar" style={{ background: '#0F172A', color: '#FFFFFF' }}>
                    <User size={13} />
                  </div>
                  <div className="chat-msg-body">
                    <div className="chat-msg-meta" style={{ justifyContent: 'flex-end' }}>
                      <span>Operator</span>
                      <span>·</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="chat-bubble">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            }

            const isPO = msg.agent === 'procurement_agent' ||
              msg.agent === 'procurement' ||
              msg.content.toLowerCase().includes('purchase order') ||
              msg.content.toLowerCase().includes('po draft') ||
              msg.content.toLowerCase().includes('draft po') ||
              msg.content.toLowerCase().includes('order');

            return (
              <div key={msg.id} className={`chat-msg assistant ${msg.is_proactive ? 'proactive' : ''}`}>
                <div className="chat-msg-avatar" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
                  {meta.icon}
                </div>
                <div className="chat-msg-body" style={{ width: '100%' }}>
                  <div className="chat-msg-meta">
                    <span className="agent-identity-badge" style={{ color: meta.color, borderColor: `${meta.color}40`, background: meta.bg }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span>·</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {msg.content && (
                    <div className="chat-bubble">
                      {renderContent(msg.content)}
                    </div>
                  )}

                  {/* Formatted ERP Document / PO Card */}
                  {msg.pending_action_id && (
                    isPO ? (
                      <PODraftCard
                        pendingActionId={msg.pending_action_id}
                        onConfirmed={(itemId) => {
                          onActionConfirmed?.(itemId);
                        }}
                        onRejected={() => {}}
                      />
                    ) : (
                      <ConfirmationCard
                        pendingActionId={msg.pending_action_id}
                        onConfirmed={(itemId) => {
                          onActionConfirmed?.(itemId);
                        }}
                        onRejected={() => {}}
                      />
                    )
                  )}

                  {/* Dynamic Chart Link Chip */}
                  {msg.metadata?.chart_spec && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (msg.metadata?.chart_spec) onChartGenerated?.(msg.metadata.chart_spec);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11.5,
                          color: 'var(--color-accent)',
                          background: 'var(--color-accent-subtle)',
                          borderColor: 'var(--color-accent)',
                        }}
                      >
                        <BarChart2 size={13} />
                        <span>View Dynamic Chart: <strong>{msg.metadata.chart_spec.title}</strong> ↗</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="chat-msg assistant">
            <div className="chat-msg-avatar" style={{ background: 'var(--color-surface-subtle)', color: 'var(--text-secondary)' }}>
              <Bot size={13} />
            </div>
            <div className="chat-msg-body">
              <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                <div className="spinner" />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Agents reasoning across ledger & inventory…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Docked composer */}
      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={send}
        disabled={loading}
      />
    </div>
  );
}

export default ChatPanel;

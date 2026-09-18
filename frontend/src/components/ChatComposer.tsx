import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import { Send, AtSign, ShoppingCart, Package, DollarSign, Users, BarChart2 } from 'lucide-react';

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

const SPECIALIST_TAGS = [
  { tag: '@procurement', label: 'Procurement', hint: 'Purchase orders, vendors, receiving', icon: <ShoppingCart size={13} />, color: '#4338CA' },
  { tag: '@inventory',   label: 'Inventory',   hint: 'Stock levels, low-stock, adjustments', icon: <Package size={13} />,      color: '#0284C7' },
  { tag: '@finance',     label: 'Finance',     hint: 'Cash position, ledger, expenses',      icon: <DollarSign size={13} />,   color: '#059669' },
  { tag: '@crm',         label: 'CRM',         hint: 'Customers, sales, history',            icon: <Users size={13} />,        color: '#7C3AED' },
  { tag: '@reporting',   label: 'Reporting',   hint: 'Sales trends, charts, analytics',      icon: <BarChart2 size={13} />,    color: '#D97706' },
];

interface MentionState {
  start: number; // index of '@' in value
  query: string; // text after '@' up to caret
}

export function ChatComposer({ value, onChange, onSend, disabled }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<MentionState | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  // Last detected mention — used to avoid resetting the highlight
  // when re-detecting an unchanged '@query' (e.g. on keyup after ArrowDown).
  const lastMention = useRef<MentionState | null>(null);

  // Auto-resize
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [value]);

  const detectMention = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const match = /@([A-Za-z]*)$/.exec(before);
    let next: MentionState | null = null;
    if (match) {
      const start = caret - match[0].length;
      // Only trigger on a fresh '@' (start of text or after whitespace)
      if (start === 0 || /\s/.test(text[start - 1])) {
        next = { start, query: match[1].toLowerCase() };
      }
    }
    const prev = lastMention.current;
    // Unchanged '@query' (e.g. keyup after ArrowUp/ArrowDown) — keep state
    // as-is so the keyboard highlight is not reset to the first hint.
    if (prev && next && prev.start === next.start && prev.query === next.query) return;
    if (!prev && !next) return;
    lastMention.current = next;
    setMention(next);
    setActiveIdx(0);
  };

  const handleChange = (v: string) => {
    onChange(v);
    // caret is one step behind during onChange; detect on next tick via select event too
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) detectMention(el.value, el.selectionStart ?? el.value.length);
    });
  };

  const handleSelect = () => {
    const el = ref.current;
    if (el) detectMention(el.value, el.selectionStart ?? el.value.length);
  };

  const filtered = mention
    ? SPECIALIST_TAGS.filter(t => t.tag.slice(1).startsWith(mention.query))
    : [];

  // Dismiss when the query no longer matches anything
  const open = mention !== null && filtered.length > 0;

  const applyTag = (tag: string) => {
    if (!mention) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = value.slice(0, mention.start) + tag + ' ' + value.slice(caret);
    onChange(next);
    lastMention.current = null;
    setMention(null);
    requestAnimationFrame(() => {
      if (el) {
        const pos = mention.start + tag.length + 1;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const target = filtered[Math.min(activeIdx, filtered.length - 1)];
        if (target) applyTag(target.tag);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        lastMention.current = null;
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        lastMention.current = null;
        setMention(null);
        onSend();
      }
    }
    if (e.key === 'Escape') {
      lastMention.current = null;
      setMention(null);
    }
  };

  const handleTagClick = (tag: string) => {
    if (value.includes(tag)) return;
    onChange(`${tag} ${value}`);
    ref.current?.focus();
  };

  return (
    <div className="chat-composer">
      {/* Quick Agent routing chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3, marginRight: 2 }}>
          <AtSign size={12} /> Route:
        </span>
        {SPECIALIST_TAGS.map(t => (
          <button
            key={t.tag}
            className="btn btn-secondary btn-sm"
            onClick={() => handleTagClick(t.tag)}
            style={{
              padding: '2px 7px',
              fontSize: 11,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              gap: 4,
            }}
          >
            <span style={{ color: t.color }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="composer-box" style={{ position: 'relative' }}>
        {open && (
          <div className="mention-popover" role="listbox" aria-label="Tag a specialist agent">
            {filtered.map((t, i) => (
              <button
                key={t.tag}
                role="option"
                aria-selected={i === activeIdx}
                className={`mention-item${i === activeIdx ? ' active' : ''}`}
                onMouseDown={e => {
                  e.preventDefault();
                  applyTag(t.tag);
                }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="mention-icon" style={{ color: t.color, background: `${t.color}18` }}>
                  {t.icon}
                </span>
                <span className="mention-text">
                  <span className="mention-tag">{t.tag}</span>
                  <span className="mention-hint">{t.hint}</span>
                </span>
              </button>
            ))}
            <div className="mention-footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>Enter</kbd> select</span>
              <span><kbd>Esc</kbd> dismiss</span>
            </div>
          </div>
        )}
        <textarea
          ref={ref}
          className="composer-textarea"
          rows={1}
          placeholder="Ask anything or @tag a specialist (e.g. @procurement order 200 filters)..."
          value={value}
          onChange={e => handleChange(e.target.value)}
          onSelect={handleSelect}
          onKeyUp={handleSelect}
          onClick={handleSelect}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        <button
          className="composer-send"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          title="Send Command (Enter)"
        >
          <Send size={14} />
        </button>
      </div>

      <div className="composer-hint">
        <span>Enter to send · Shift+Enter for newline</span>
        <span>Zero Silent Commits Policy Active</span>
      </div>
    </div>
  );
}

export default ChatComposer;

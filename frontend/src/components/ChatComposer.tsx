import { useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Paperclip } from 'lucide-react';

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export function ChatComposer({ value, onChange, onSend, disabled }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <div className="chat-composer">
      <div className="composer-box">
        <button className="btn btn-ghost btn-icon" style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', padding: 4 }}>
          <Paperclip size={15} />
        </button>
        <textarea
          ref={ref}
          className="composer-textarea"
          rows={1}
          placeholder="Message agents… use @inventory, @procurement, @finance, @crm, @reporting"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button
          className="composer-send"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          title="Send (Enter)"
        >
          <Send size={14} />
        </button>
      </div>
      <p className="composer-hint">Enter to send · Shift+Enter for newline · @tag to route directly</p>
    </div>
  );
}

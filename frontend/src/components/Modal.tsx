import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ title, subtitle, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, animation: 'fadeIn 0.15s ease',
      }}
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div
        style={{
          width: wide ? 640 : 480, maxWidth: '100%', maxHeight: '90vh',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 12px 40px -8px rgba(15, 23, 42, 0.25)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'modalIn 0.18s cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"
            style={{ padding: 6 }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: '16px 18px', overflowY: 'auto' }}>{children}</div>
        {footer && (
          <div style={{
            padding: '12px 18px', borderTop: '1px solid var(--color-border)',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            background: 'var(--color-surface-subtle)',
          }}>
            {footer}
          </div>
        )}
      </div>
      <style>{`@keyframes modalIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}

export function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: ReactNode;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {label} {required && <span style={{ color: 'var(--color-red)' }}>*</span>}
      </div>
      {children}
      {error && <div style={{ fontSize: 11, color: 'var(--color-red)', marginTop: 3 }}>{error}</div>}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 10px', fontSize: 13,
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
  background: 'var(--color-bg-input)', outline: 'none', boxSizing: 'border-box',
};

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div style={{
      fontSize: 12, color: 'var(--color-red)', background: 'var(--color-red-bg)',
      border: '1px solid var(--color-red-border)', borderRadius: 'var(--radius-sm)',
      padding: '8px 10px', marginBottom: 12,
    }}>
      {message}
    </div>
  );
}

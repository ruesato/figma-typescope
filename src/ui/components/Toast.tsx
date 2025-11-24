import { useEffect } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'loading';
  onClose?: () => void;
  duration?: number; // Auto-close duration in ms (0 = no auto-close)
}

/**
 * Toast Notification Component
 *
 * Displays notification messages at the top of the plugin window.
 * - Success: Green with checkmark icon
 * - Error: Red with X icon
 * - Loading: Blue with spinner icon (no auto-close)
 */
export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  // Auto-close after duration (except for loading toasts)
  useEffect(() => {
    if (type === 'loading' || duration === 0 || !onClose) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [type, duration, onClose]);

  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'var(--figma-color-bg-success)',
          border: 'var(--figma-color-border-success)',
          text: 'var(--figma-color-text-success)',
          icon: <CheckCircle size={16} />,
        };
      case 'error':
        return {
          bg: 'var(--figma-color-bg-danger)',
          border: 'var(--figma-color-border-danger)',
          text: 'var(--figma-color-text-danger)',
          icon: <XCircle size={16} />,
        };
      case 'loading':
        return {
          bg: 'var(--figma-color-bg-brand)',
          border: 'var(--figma-color-border-brand)',
          text: 'var(--figma-color-text-onbrand)',
          icon: <Loader2 size={16} className="animate-spin" />,
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--figma-space-md)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--figma-space-sm)',
        padding: '12px 16px',
        backgroundColor: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        color: styles.text,
        fontSize: '12px',
        fontWeight: 500,
        maxWidth: '90%',
        animation: 'slideDown 200ms ease-out',
      }}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{styles.icon}</div>

      {/* Message */}
      <div style={{ flex: 1 }}>{message}</div>

      {/* Close button (only for non-loading toasts) */}
      {type !== 'loading' && onClose && (
        <button
          onClick={onClose}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            border: 'none',
            background: 'transparent',
            color: styles.text,
            cursor: 'pointer',
            opacity: 0.7,
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
          }}
          aria-label="Close notification"
        >
          ×
        </button>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

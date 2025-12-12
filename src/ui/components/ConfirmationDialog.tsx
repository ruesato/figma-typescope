import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation Dialog Component
 *
 * Reusable modal for confirming destructive operations.
 * Used for style replacement, token replacement, and other bulk operations.
 *
 * @example
 * ```tsx
 * <ConfirmationDialog
 *   isOpen={showDialog}
 *   title="Replace Style"
 *   message="Replace [Old Style] with [New Style] in 127 text layers?"
 *   confirmLabel="Replace"
 *   cancelLabel="Cancel"
 *   variant="warning"
 *   onConfirm={() => executeReplacement()}
 *   onCancel={() => setShowDialog(false)}
 * />
 * ```
 */
export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  // Get variant-specific styles using Figma design tokens
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: '⚠️',
          confirmBg: 'bg-figma-color-text-danger hover:bg-figma-color-text-danger/90',
        };
      case 'warning':
        return {
          icon: '⚡',
          confirmBg: 'bg-figma-bg-brand hover:bg-figma-bg-brand/90',
        };
      case 'info':
        return {
          icon: 'ℹ️',
          confirmBg: 'bg-figma-bg-brand hover:bg-figma-bg-brand/90',
        };
    }
  };

  const styles = getVariantStyles();

  // Handle ESC key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onCancel}
    >
      <div
        className="
          relative w-full max-w-md p-6 rounded-lg
          bg-figma-bg
          border border-figma-border
          shadow-xl
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl flex-shrink-0">{styles.icon}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-figma-text">
              {title}
            </h2>
          </div>
        </div>

        {/* Message */}
        <p className="text-sm text-figma-text-secondary mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="
              px-4 py-2 text-sm rounded
              bg-figma-bg-secondary
              text-figma-text
              hover:bg-figma-bg-hover
              transition-colors
            "
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`
              px-4 py-2 text-sm rounded
              text-figma-text-onbrand
              ${styles.confirmBg}
              transition-colors
            `}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

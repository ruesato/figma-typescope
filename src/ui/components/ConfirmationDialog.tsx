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

  // Get variant-specific styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: '⚠️',
          confirmBg: 'bg-red-600 hover:bg-red-700',
          borderColor: 'border-red-200 dark:border-red-800',
        };
      case 'warning':
        return {
          icon: '⚡',
          confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
        };
      case 'info':
        return {
          icon: 'ℹ️',
          confirmBg: 'bg-blue-600 hover:bg-blue-700',
          borderColor: 'border-blue-200 dark:border-blue-800',
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
        className={`
          relative w-full max-w-md p-6 rounded-lg
          bg-white dark:bg-gray-900
          border ${styles.borderColor}
          shadow-xl
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl flex-shrink-0">{styles.icon}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
          </div>
        </div>

        {/* Message */}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="
              px-4 py-2 text-sm rounded
              bg-gray-200 dark:bg-gray-700
              text-gray-900 dark:text-gray-100
              hover:bg-gray-300 dark:hover:bg-gray-600
              transition-colors
            "
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`
              px-4 py-2 text-sm rounded
              text-white
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

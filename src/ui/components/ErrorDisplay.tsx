import React from 'react';

interface ErrorDisplayProps {
  error: string;
  errorType?: 'validation' | 'scanning' | 'processing' | 'checkpoint' | 'permission' | 'VALIDATION' | 'API' | 'UNKNOWN';
  canRetry?: boolean;
  canRollback?: boolean;
  checkpointTitle?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  onRollback?: () => void;
}

/**
 * Error Display Component
 *
 * Displays error messages with appropriate styling and optional actions.
 *
 * @example
 * ```tsx
 * <ErrorDisplay
 *   error="Failed to load fonts"
 *   errorType="API"
 *   onRetry={() => runAudit()}
 *   onDismiss={() => setError(null)}
 * />
 * ```
 */
export default function ErrorDisplay({
  error,
  errorType = 'UNKNOWN',
  canRetry = false,
  canRollback = false,
  checkpointTitle,
  onDismiss,
  onRetry,
  onRollback,
}: ErrorDisplayProps) {
  // Get error icon based on type
  const getErrorIcon = () => {
    switch (errorType) {
      case 'validation':
      case 'VALIDATION':
        return '⚠️';
      case 'permission':
        return '🔒';
      case 'checkpoint':
        return '💾';
      case 'scanning':
      case 'processing':
      case 'API':
        return '❌';
      case 'UNKNOWN':
      default:
        return '🚫';
    }
  };

  // Get error title based on type
  const getErrorTitle = () => {
    switch (errorType) {
      case 'validation':
      case 'VALIDATION':
        return 'Validation Error';
      case 'permission':
        return 'Permission Denied';
      case 'checkpoint':
        return 'Checkpoint Error';
      case 'scanning':
        return 'Scanning Error';
      case 'processing':
        return 'Processing Error';
      case 'API':
        return 'API Error';
      case 'UNKNOWN':
      default:
        return 'Error';
    }
  };

  return (
    <div
      className="
        p-4 rounded-md
        bg-red-50 dark:bg-red-900/20
        border border-red-200 dark:border-red-800
      "
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <span className="text-xl flex-shrink-0">{getErrorIcon()}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-red-900 dark:text-red-100">
            {getErrorTitle()}
          </h3>
          <p className="text-sm text-red-800 dark:text-red-200 mt-1">
            {error}
          </p>
          {canRollback && checkpointTitle && (
            <p className="text-xs text-red-700 dark:text-red-300 mt-2">
              Rollback checkpoint available: <span className="font-mono">{checkpointTitle}</span>
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {(canRetry || canRollback || onDismiss) && (
        <div className="flex gap-2 mt-3">
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              className="
                px-3 py-1 text-xs rounded
                bg-red-600 text-white
                hover:bg-red-700
                transition-colors
              "
            >
              Try Again
            </button>
          )}
          {canRollback && onRollback && (
            <button
              onClick={onRollback}
              className="
                px-3 py-1 text-xs rounded
                bg-yellow-600 text-white
                hover:bg-yellow-700
                transition-colors
              "
            >
              Rollback to Checkpoint
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="
                px-3 py-1 text-xs rounded
                bg-red-100 dark:bg-red-900/40
                text-red-900 dark:text-red-100
                hover:bg-red-200 dark:hover:bg-red-900/60
                transition-colors
              "
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}

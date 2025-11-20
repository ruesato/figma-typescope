import React from 'react';

interface ErrorDisplayProps {
  error: string;
  errorType?: 'VALIDATION' | 'API' | 'UNKNOWN';
  onDismiss?: () => void;
  onRetry?: () => void;
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
  onDismiss,
  onRetry,
}: ErrorDisplayProps) {
  // Get error icon based on type
  const getErrorIcon = () => {
    switch (errorType) {
      case 'VALIDATION':
        return '⚠️';
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
      case 'VALIDATION':
        return 'Invalid Input';
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
        </div>
      </div>

      {/* Actions */}
      {(onRetry || onDismiss) && (
        <div className="flex gap-2 mt-3">
          {onRetry && (
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

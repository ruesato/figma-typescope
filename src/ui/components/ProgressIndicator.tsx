import React from 'react';
import type { AuditState, ReplacementState } from '@/shared/types';

interface ProgressIndicatorProps {
  progress: number; // 0-100
  current?: number;
  total?: number;
  message?: string;
  state?: AuditState | ReplacementState; // Optional: for state-specific rendering
}

/**
 * Progress Indicator Component
 *
 * Displays a progress bar with optional count and message.
 * Supports state-specific rendering:
 * - validating/creating_checkpoint: Indeterminate spinner
 * - scanning/processing: Progress bar with percentage
 *
 * @example
 * ```tsx
 * <ProgressIndicator
 *   progress={75}
 *   current={150}
 *   total={200}
 *   message="Processing text layers..."
 *   state="processing"
 * />
 * ```
 */
export default function ProgressIndicator({
  progress,
  current,
  total,
  message,
  state,
}: ProgressIndicatorProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  // Determine if we should show spinner instead of progress bar
  const showSpinner = state === 'validating' || state === 'creating_checkpoint';

  // Get state-specific message if not provided
  const displayMessage = message || getStateMessage(state);

  return (
    <div className="space-y-2">
      {/* Message and count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-figma-text-secondary">
          {displayMessage}
        </span>
        {current !== undefined && total !== undefined && !showSpinner && (
          <span className="text-figma-text-tertiary text-xs">
            {current} / {total}
          </span>
        )}
      </div>

      {showSpinner ? (
        /* Indeterminate spinner for validating/checkpoint states */
        <div className="flex items-center justify-center py-2">
          <div className="w-5 h-5 border-2 border-figma-bg-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="relative w-full h-2 bg-figma-bg-tertiary rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-figma-bg-brand rounded-full transition-all duration-300 ease-out"
              style={{ width: `${clampedProgress}%` }}
            />
          </div>

          {/* Percentage */}
          <div className="text-xs text-figma-text-tertiary text-center">
            {Math.round(clampedProgress)}%
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Get default message for state
 */
function getStateMessage(state?: AuditState | ReplacementState): string {
  switch (state) {
    case 'validating':
      return 'Validating document...';
    case 'scanning':
      return 'Scanning pages...';
    case 'processing':
      return 'Processing layers...';
    case 'creating_checkpoint':
      return 'Creating version checkpoint...';
    case 'complete':
      return 'Complete!';
    case 'error':
      return 'Error occurred';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Processing...';
  }
}

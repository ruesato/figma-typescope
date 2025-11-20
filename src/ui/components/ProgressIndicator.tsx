import React from 'react';

interface ProgressIndicatorProps {
  progress: number; // 0-100
  current?: number;
  total?: number;
  message?: string;
}

/**
 * Progress Indicator Component
 *
 * Displays a progress bar with optional count and message.
 *
 * @example
 * ```tsx
 * <ProgressIndicator
 *   progress={75}
 *   current={150}
 *   total={200}
 *   message="Processing text layers..."
 * />
 * ```
 */
export default function ProgressIndicator({
  progress,
  current,
  total,
  message,
}: ProgressIndicatorProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="space-y-2">
      {/* Message and count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-figma-text-secondary">
          {message || 'Processing...'}
        </span>
        {current !== undefined && total !== undefined && (
          <span className="text-figma-text-tertiary text-xs">
            {current} / {total}
          </span>
        )}
      </div>

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
    </div>
  );
}

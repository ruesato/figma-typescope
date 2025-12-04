import React, { useState, useEffect } from 'react';
import type { AuditState, ReplacementState } from '@/shared/types';

interface ProgressIndicatorProps {
  progress: number; // 0-100
  current?: number;
  total?: number;
  message?: string;
  state?: AuditState | ReplacementState; // Optional: for state-specific rendering
}

interface Step {
  label: string;
  state: 'pending' | 'active' | 'complete';
  timestamp?: number;
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
  const [steps, setSteps] = useState<Step[]>([]);

  // Track state transitions and build step list
  useEffect(() => {
    if (!state) return;

    setSteps((prevSteps) => {
      const newSteps = [...prevSteps];
      const stateLabel = getStateMessage(state);

      // Find if this state already exists
      const existingIndex = newSteps.findIndex(s => s.label === stateLabel);

      if (existingIndex >= 0) {
        // Mark as active if not complete
        if (state !== 'complete' && state !== 'error' && state !== 'cancelled') {
          newSteps[existingIndex].state = 'active';
        } else if (state === 'complete') {
          // Mark all as complete
          return newSteps.map(s => ({ ...s, state: 'complete' as const }));
        }
      } else {
        // Add new step
        // Mark previous steps as complete
        const updatedSteps = newSteps.map(s =>
          s.state === 'active' ? { ...s, state: 'complete' as const } : s
        );
        updatedSteps.push({
          label: stateLabel,
          state: 'active',
          timestamp: Date.now(),
        });
        return updatedSteps;
      }

      return newSteps;
    });
  }, [state]);

  // Add custom message as a step if it's different from state message
  useEffect(() => {
    if (!message || !state) return;

    const stateMessage = getStateMessage(state);
    if (message && message !== stateMessage && message.trim()) {
      setSteps((prevSteps) => {
        const lastStep = prevSteps[prevSteps.length - 1];

        // Only add if it's a new message
        if (!lastStep || lastStep.label !== message) {
          const newSteps = prevSteps.map(s =>
            s.state === 'active' ? { ...s, state: 'complete' as const } : s
          );
          newSteps.push({
            label: message,
            state: 'active',
            timestamp: Date.now(),
          });
          return newSteps;
        }
        return prevSteps;
      });
    }
  }, [message, state]);

  // Reset steps when progress goes back to 0
  useEffect(() => {
    if (progress === 0 && state === 'validating') {
      setSteps([]);
    }
  }, [progress, state]);

  // Determine if we should show spinner instead of progress bar
  const showSpinner = state === 'validating' || state === 'creating_checkpoint';

  // Get state-specific message if not provided
  const displayMessage = message || getStateMessage(state);

  return (
    <div className="space-y-4">
      {/* Progress bar section */}
      <div className="space-y-2">
        {/* Message and count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-figma-text-secondary font-medium">
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

      {/* Steps list */}
      {steps.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'var(--figma-color-bg-secondary)',
            borderRadius: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {steps.map((step, index) => (
            <div
              key={`${step.label}-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                lineHeight: '16px',
              }}
            >
              {/* Status indicator */}
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor:
                    step.state === 'complete'
                      ? 'var(--figma-color-icon-success)'
                      : step.state === 'active'
                      ? 'var(--figma-color-bg-brand)'
                      : 'var(--figma-color-icon-tertiary)',
                  flexShrink: 0,
                }}
              />

              {/* Step label */}
              <span
                style={{
                  color:
                    step.state === 'active'
                      ? 'var(--figma-color-text)'
                      : 'var(--figma-color-text-secondary)',
                  fontWeight: step.state === 'active' ? 500 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
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

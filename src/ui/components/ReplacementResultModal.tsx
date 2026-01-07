import React from 'react';
import type { ReplacementResult } from '@/shared/types';

interface ReplacementResultModalProps {
  isOpen: boolean;
  result: ReplacementResult;
  sourceName: string;
  targetName: string;
  operationType: 'style' | 'token';
  onClose: () => void;
}

/**
 * Replacement Result Modal Component
 *
 * Shows detailed replacement operation results after completion.
 * Displays stats, category breakdown, and checkpoint information.
 *
 * @example
 * ```tsx
 * <ReplacementResultModal
 *   isOpen={showResults}
 *   result={replacementResult}
 *   sourceName="Old Style"
 *   targetName="New Style"
 *   operationType="style"
 *   onClose={() => setShowResults(false)}
 * />
 * ```
 */
export default function ReplacementResultModal({
  isOpen,
  result,
  sourceName,
  targetName,
  operationType,
  onClose,
}: ReplacementResultModalProps) {
  if (!isOpen) return null;

  const { success, layersUpdated, layersFailed, layersSkipped, duration, checkpointTitle, categoryBreakdown } = result;

  // Determine variant based on result
  const variant = layersFailed > 0 ? (success ? 'warning' : 'danger') : 'success';

  // Get variant-specific styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          icon: '✓',
          iconColor: 'text-figma-text-success',
          title: 'Replacement Complete',
        };
      case 'warning':
        return {
          icon: '⚠️',
          iconColor: 'text-figma-text-warning',
          title: 'Replacement Complete (with warnings)',
        };
      case 'danger':
        return {
          icon: '✕',
          iconColor: 'text-figma-text-danger',
          title: 'Replacement Failed',
        };
    }
  };

  const styles = getVariantStyles();

  // Handle ESC key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="
          relative w-full max-w-lg p-6 rounded-lg
          bg-figma-bg
          border border-figma-border
          shadow-xl
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <span className={`text-2xl flex-shrink-0 ${styles.iconColor}`}>{styles.icon}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-figma-text mb-1">
              {styles.title}
            </h2>
            <p className="text-sm text-figma-text-secondary">
              Replaced <span className="font-medium text-figma-text">"{sourceName}"</span> with{' '}
              <span className="font-medium text-figma-text">"{targetName}"</span>
            </p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="mb-4 p-4 rounded bg-figma-bg-secondary border border-figma-border">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-figma-text-secondary">Layers updated:</span>
            <span className="text-sm font-medium text-figma-text">{layersUpdated}</span>
          </div>

          {layersFailed > 0 && (
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-figma-text-secondary">Layers failed:</span>
              <span className="text-sm font-medium text-figma-text-danger">{layersFailed}</span>
            </div>
          )}

          {(layersSkipped ?? 0) > 0 && (
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-figma-text-secondary">Layers skipped:</span>
              <span className="text-sm font-medium text-figma-text-tertiary">
                {layersSkipped}
                <span className="text-xs ml-1">(will inherit from main component)</span>
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-sm text-figma-text-secondary">Duration:</span>
            <span className="text-sm font-medium text-figma-text">
              {(duration / 1000).toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Category Breakdown */}
        {categoryBreakdown && (
          <div className="mb-4 p-4 rounded bg-figma-bg-secondary border border-figma-border">
            <h3 className="text-xs font-semibold text-figma-text-secondary uppercase mb-3">
              Category Breakdown
            </h3>
            {categoryBreakdown.mainComponents > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-figma-text-secondary">Main components:</span>
                <span className="text-sm font-medium text-figma-text">
                  {categoryBreakdown.mainComponents}
                </span>
              </div>
            )}
            {categoryBreakdown.libraryInstances > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-figma-text-secondary">Library instances:</span>
                <span className="text-sm font-medium text-figma-text">
                  {categoryBreakdown.libraryInstances}
                </span>
              </div>
            )}
            {categoryBreakdown.detachedInstances > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-figma-text-secondary">Detached instances:</span>
                <span className="text-sm font-medium text-figma-text">
                  {categoryBreakdown.detachedInstances}
                </span>
              </div>
            )}
            {categoryBreakdown.instancesWithOverride > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-figma-text-secondary">Instances with override:</span>
                <span className="text-sm font-medium text-figma-text">
                  {categoryBreakdown.instancesWithOverride}
                </span>
              </div>
            )}
            {categoryBreakdown.plainText > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-figma-text-secondary">Plain text:</span>
                <span className="text-sm font-medium text-figma-text">
                  {categoryBreakdown.plainText}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Checkpoint Info */}
        {checkpointTitle && (
          <div className="mb-6 p-3 rounded bg-figma-bg-tertiary border border-figma-border">
            <div className="flex items-start gap-2">
              <span className="text-xs text-figma-text-tertiary flex-shrink-0 mt-0.5">📌</span>
              <div>
                <p className="text-xs text-figma-text-tertiary mb-0.5">Version checkpoint created:</p>
                <p className="text-xs font-medium text-figma-text">{checkpointTitle}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="
              px-5 py-2 text-sm font-medium rounded
              bg-figma-bg-brand
              text-figma-text-onbrand
              hover:bg-figma-bg-brand-hover
              transition-colors
            "
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

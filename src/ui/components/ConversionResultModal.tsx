import React from 'react';

interface ConversionResultModalProps {
  isOpen: boolean;
  totalConverted: number;
  duration: number;
  layersAffected?: number;
  layersSkipped?: number;
  categoryBreakdown?: {
    mainComponents: number;
    instancesWithOverride: number;
    libraryInstances: number;
    detachedInstances: number;
    plainText: number;
  };
  onClose: () => void;
}

/**
 * Conversion Result Modal Component
 *
 * Shows detailed conversion operation results after completion.
 * Displays number of styles converted, layers affected, and category breakdown.
 *
 * @example
 * ```tsx
 * <ConversionResultModal
 *   isOpen={showResults}
 *   totalConverted={13}
 *   duration={6800}
 *   layersAffected={285}
 *   categoryBreakdown={...}
 *   onClose={() => setShowResults(false)}
 * />
 * ```
 */
export default function ConversionResultModal({
  isOpen,
  totalConverted,
  duration,
  layersAffected,
  layersSkipped,
  categoryBreakdown,
  onClose,
}: ConversionResultModalProps) {
  if (!isOpen) return null;

  const durationSec = (duration / 1000).toFixed(1);

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
          <span className="text-2xl flex-shrink-0 text-figma-text-success">✓</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-figma-text mb-1">
              Conversion Complete
            </h2>
            <p className="text-sm text-figma-text-secondary">
              Converted {totalConverted} style{totalConverted !== 1 ? 's' : ''} to local in {durationSec}s
            </p>
          </div>
        </div>

        {/* Layers Affected Summary */}
        {layersAffected !== undefined && layersAffected > 0 && (
          <div className="mb-4 p-4 rounded bg-figma-bg-secondary border border-figma-border">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-figma-text-secondary">Layers updated:</span>
              <span className="text-sm font-medium text-figma-text">{layersAffected}</span>
            </div>

            {(layersSkipped ?? 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-figma-text-secondary">Layers skipped:</span>
                <span className="text-sm font-medium text-figma-text-tertiary">
                  {layersSkipped}
                  <span className="text-xs ml-1">(will inherit from main component)</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Category Breakdown */}
        {categoryBreakdown && (
          <div className="mb-6 p-4 rounded bg-figma-bg-secondary border border-figma-border">
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
            {categoryBreakdown.instancesWithOverride > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-figma-text-secondary">Instances with override:</span>
                <span className="text-sm font-medium text-figma-text">
                  {categoryBreakdown.instancesWithOverride}
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

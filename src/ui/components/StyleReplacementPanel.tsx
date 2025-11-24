import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import StyleTreeView from './StyleTreeView';
import type { TextStyle, LibrarySource, TextLayer } from '@/shared/types';

export interface StyleReplacementPanelProps {
  /** Source style being replaced */
  sourceStyle: TextStyle;
  /** All available styles to choose from */
  availableStyles: TextStyle[];
  /** Library sources */
  libraries: LibrarySource[];
  /** All text layers (for StyleTreeView compatibility) */
  allLayers: TextLayer[];
  /** Callback when panel should close */
  onClose: () => void;
  /** Callback when replacement is confirmed */
  onReplace: (sourceStyle: TextStyle, targetStyle: TextStyle) => void;
  /** Optional error message to display at top of panel */
  error?: string;
  /** IDs of styles that have been replaced (for green circle indicator) */
  replacedStyleIds?: Set<string>;
}

/**
 * Style Replacement Panel Component
 *
 * Slide-over panel for selecting a target style to replace the source style.
 * - Slides in from the right (440px min width, 50% max width)
 * - 200ms ease-out animation
 * - Dark scrim overlay
 * - ESC key, scrim click, Cancel button, or X button closes panel
 * - "Replace" button disabled until target style selected
 */
export default function StyleReplacementPanel({
  sourceStyle,
  availableStyles,
  libraries,
  allLayers,
  onClose,
  onReplace,
  error,
  replacedStyleIds,
}: StyleReplacementPanelProps) {
  const [selectedTargetStyle, setSelectedTargetStyle] = useState<TextStyle | null>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Animate out then close
  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      onClose();
    }, 200); // Match animation duration
  };

  // Handle Replace button click
  const handleReplace = () => {
    if (!selectedTargetStyle) return;
    onReplace(sourceStyle, selectedTargetStyle);
    handleClose();
  };

  return (
    <>
      {/* Scrim overlay */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: isAnimatingOut ? 'fadeOut 200ms ease-out' : 'fadeIn 200ms ease-out',
        }}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '440px',
          minWidth: '440px',
          maxWidth: '50%',
          backgroundColor: 'var(--figma-color-bg)',
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          animation: isAnimatingOut ? 'slideOut 200ms ease-out' : 'slideIn 200ms ease-out',
        }}
      >
        {/* Error banner (if present) */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--figma-color-bg-danger)',
              borderBottom: '1px solid var(--figma-color-border-danger)',
              color: 'var(--figma-color-text-danger)',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--figma-space-md)',
            borderBottom: '1px solid var(--figma-color-border)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--figma-color-text)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Replace Style: {sourceStyle.name}
            </h2>
            <p
              style={{
                fontSize: '11px',
                color: 'var(--figma-color-text-secondary)',
                margin: '4px 0 0 0',
              }}
            >
              Select a target style from the list below
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--figma-color-text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: 'var(--figma-space-sm)',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Style Tree - Scrollable */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <StyleTreeView
            styles={availableStyles}
            libraries={libraries}
            unstyledLayers={[]} // Not showing unstyled layers in replacement panel
            onStyleSelect={setSelectedTargetStyle}
            selectedStyleId={selectedTargetStyle?.id}
            disabledStyleId={sourceStyle.id} // Disable the source style with "Current" badge
            replacedStyleIds={replacedStyleIds}
          />
        </div>

        {/* Footer - Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 'var(--figma-space-sm)',
            padding: 'var(--figma-space-md)',
            borderTop: '1px solid var(--figma-color-border)',
          }}
        >
          {/* Cancel button */}
          <button
            onClick={handleClose}
            style={{
              height: '32px',
              padding: '0 16px',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'var(--figma-color-text)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </button>

          {/* Replace button */}
          <button
            onClick={handleReplace}
            disabled={!selectedTargetStyle}
            style={{
              height: '32px',
              padding: '0 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: selectedTargetStyle
                ? 'var(--figma-color-bg-brand)'
                : 'var(--figma-color-bg-disabled)',
              color: selectedTargetStyle
                ? 'var(--figma-color-text-onbrand)'
                : 'var(--figma-color-text-disabled)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: selectedTargetStyle ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedTargetStyle) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Replace
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(100%);
          }
        }
      `}</style>
    </>
  );
}

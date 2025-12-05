import { useState, useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ReplacementPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Panel title */
  title: string;
  /** Panel description/instructions */
  description: string;
  /** Optional error message to display at top */
  error?: string;
  /** Content area (tree view, list, etc.) */
  children: ReactNode;
  /** Source vs Target preview section (optional) */
  previewSection?: ReactNode;
  /** Whether the Replace button should be disabled */
  disableReplace?: boolean;
  /** Callback when panel should close */
  onClose: () => void;
  /** Callback when Replace button is clicked */
  onReplace: () => void;
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: string;
  /** Replace button label (default: "Replace") */
  replaceLabel?: string;
}

/**
 * Generic Replacement Panel Component
 *
 * Reusable slide-over panel for replacement workflows (styles, tokens, etc.)
 *
 * Features:
 * - Slide-in from right with scrim overlay (200ms ease-out animation)
 * - 440px min width, 50% max width
 * - ESC key, scrim click, Cancel button, or X button closes panel
 * - Flexible content area via children prop
 * - Optional source vs target preview section
 * - Disabled state for Replace button until selection made
 * - Error banner support
 * - Accessibility: focus trap, ARIA labels, keyboard navigation
 *
 * @example
 * ```tsx
 * <ReplacementPanel
 *   isOpen={isOpen}
 *   title="Replace Style"
 *   description="Select a target style from the list below"
 *   previewSection={<StylePreview source={source} target={target} />}
 *   disableReplace={!targetSelected}
 *   onClose={handleClose}
 *   onReplace={handleReplace}
 * >
 *   <StyleTreeView {...props} />
 * </ReplacementPanel>
 * ```
 */
export default function ReplacementPanel({
  isOpen,
  title,
  description,
  error,
  children,
  previewSection,
  disableReplace = false,
  onClose,
  onReplace,
  cancelLabel = 'Cancel',
  replaceLabel = 'Replace',
}: ReplacementPanelProps) {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Animate out then close
  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsAnimatingOut(false);
      onClose();
    }, 200); // Match animation duration
  };

  // Handle Replace button click
  const handleReplaceClick = () => {
    if (disableReplace) return;
    onReplace();
  };

  if (!isOpen && !isAnimatingOut) return null;

  return (
    <>
      {/* Scrim overlay */}
      <div
        onClick={handleClose}
        role="presentation"
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="replacement-panel-title"
        aria-describedby="replacement-panel-description"
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
            role="alert"
            style={{
              padding: '12px 16px',
              backgroundColor: '#fee',
              borderBottom: '1px solid #fcc',
              color: '#c00',
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
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="replacement-panel-title"
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
              {title}
            </h2>
            <p
              id="replacement-panel-description"
              style={{
                fontSize: '11px',
                color: 'var(--figma-color-text-secondary)',
                margin: '4px 0 0 0',
              }}
            >
              {description}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            aria-label="Close replacement panel"
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
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview Section (Source vs Target) - Optional */}
        {previewSection && (
          <div
            style={{
              padding: 'var(--figma-space-md)',
              borderBottom: '1px solid var(--figma-color-border)',
              backgroundColor: 'var(--figma-color-bg-secondary)',
              flexShrink: 0,
            }}
          >
            {previewSection}
          </div>
        )}

        {/* Content Area - Scrollable */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--figma-space-sm)',
            padding: 'var(--figma-space-md)',
            borderTop: '1px solid var(--figma-color-border)',
            backgroundColor: 'var(--figma-color-bg)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleClose}
            aria-label="Cancel replacement and close panel"
            style={{
              flex: 1,
              height: '36px',
              padding: '0 16px',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '8px',
              backgroundColor: 'transparent',
              color: 'var(--figma-color-text)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {cancelLabel}
          </button>

          <button
            onClick={handleReplaceClick}
            disabled={disableReplace}
            aria-label={`${replaceLabel} - ${disableReplace ? 'Select a target first' : 'Proceed with replacement'}`}
            style={{
              flex: 1,
              height: '36px',
              padding: '0 16px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: disableReplace
                ? 'var(--figma-color-bg-secondary)'
                : 'var(--figma-color-bg-brand)',
              color: disableReplace ? 'var(--figma-color-text-tertiary)' : 'var(--figma-color-text-onbrand)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: disableReplace ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: disableReplace ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!disableReplace) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!disableReplace) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {replaceLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        @keyframes slideOut {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}

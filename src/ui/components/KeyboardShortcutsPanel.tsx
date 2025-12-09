/**
 * KeyboardShortcutsPanel Component
 *
 * Displays available keyboard shortcuts and navigation hints.
 * Helps users understand keyboard-only navigation capabilities.
 */

import { keyboardShortcuts, formatKeyboardShortcutsDisplay } from '@/ui/utils/accessibility';

interface KeyboardShortcutsPanelProps {
  onClose?: () => void;
  compact?: boolean;
}

export default function KeyboardShortcutsPanel({
  onClose,
  compact = false,
}: KeyboardShortcutsPanelProps) {
  const shortcuts = Object.entries(keyboardShortcuts);

  if (compact) {
    return (
      <div className="p-2 bg-figma-bg-secondary rounded text-xs text-figma-text-secondary">
        <p className="font-medium mb-2">Quick Navigation:</p>
        <ul className="space-y-1">
          {shortcuts.slice(0, 6).map(([_, { key, description }]) => (
            <li key={key}>
              <kbd className="px-2 py-0.5 bg-figma-bg-tertiary rounded border border-figma-border text-xs font-mono">
                {key}
              </kbd>
              {' → '}
              {description}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50">
      <div className="bg-figma-bg rounded-lg shadow-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-figma-bg border-b border-figma-border p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-figma-text">Keyboard Shortcuts</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-figma-text-secondary hover:text-figma-text"
              aria-label="Close shortcuts panel"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Tree Navigation */}
          <div>
            <h3 className="font-semibold text-figma-text mb-2">Tree Navigation</h3>
            <ul className="space-y-1 text-sm text-figma-text-secondary">
              <li className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-figma-bg-secondary rounded border border-figma-border text-xs font-mono flex-shrink-0">
                  ↑ ↓
                </kbd>
                <span>Move between nodes</span>
              </li>
              <li className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-figma-bg-secondary rounded border border-figma-border text-xs font-mono flex-shrink-0">
                  ← →
                </kbd>
                <span>Collapse/expand nodes</span>
              </li>
              <li className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-figma-bg-secondary rounded border border-figma-border text-xs font-mono flex-shrink-0">
                  Space
                </kbd>
                <span>Toggle expand/collapse</span>
              </li>
            </ul>
          </div>

          {/* Selection & Actions */}
          <div>
            <h3 className="font-semibold text-figma-text mb-2">Selection & Actions</h3>
            <ul className="space-y-1 text-sm text-figma-text-secondary">
              <li className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-figma-bg-secondary rounded border border-figma-border text-xs font-mono flex-shrink-0">
                  Enter
                </kbd>
                <span>Select/activate</span>
              </li>
              <li className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-figma-bg-secondary rounded border border-figma-border text-xs font-mono flex-shrink-0">
                  Tab
                </kbd>
                <span>Move between sections</span>
              </li>
              <li className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-figma-bg-secondary rounded border border-figma-border text-xs font-mono flex-shrink-0">
                  Shift+Tab
                </kbd>
                <span>Move to previous section</span>
              </li>
            </ul>
          </div>

          {/* Search & Filters */}
          <div>
            <h3 className="font-semibold text-figma-text mb-2">Search & Filters</h3>
            <ul className="space-y-1 text-sm text-figma-text-secondary">
              <li className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-figma-bg-secondary rounded border border-figma-border text-xs font-mono flex-shrink-0">
                  Ctrl+F / Cmd+F
                </kbd>
                <span>Open search</span>
              </li>
            </ul>
          </div>

          {/* Dialogs */}
          <div>
            <h3 className="font-semibold text-figma-text mb-2">Dialogs & Modals</h3>
            <ul className="space-y-1 text-sm text-figma-text-secondary">
              <li className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-figma-bg-secondary rounded border border-figma-border text-xs font-mono flex-shrink-0">
                  Esc
                </kbd>
                <span>Close dialog</span>
              </li>
            </ul>
          </div>

          {/* Tips */}
          <div className="bg-figma-bg-secondary rounded p-3 text-xs text-figma-text-secondary">
            <p className="font-medium mb-1">💡 Tip:</p>
            <p>The entire plugin can be operated using keyboard only. Try navigating without your mouse!</p>
          </div>
        </div>

        {/* Footer */}
        {onClose && (
          <div className="border-t border-figma-border p-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="
                px-4 py-2 rounded text-sm font-medium
                bg-figma-bg-secondary text-figma-text
                hover:bg-figma-bg-tertiary
                focus:outline-none focus:ring-2 focus:ring-figma-bg-brand
              "
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * EmptyStateMessage Component
 *
 * Displays helpful messages for various empty states and edge cases.
 * Used across all views when there's no data to display.
 */

interface EmptyStateMessageProps {
  type:
    | 'no-text-layers'
    | 'run-audit'
    | 'no-tokens'
    | 'no-results'
    | 'select-style'
    | 'select-token';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const emptyStateConfigs: Record<string, { icon: string; title: string; description: string }> = {
  'no-text-layers': {
    icon: '📄',
    title: 'No Text Layers Found',
    description: 'This document contains no text layers. Add text to your design to see results.',
  },
  'run-audit': {
    icon: '🔍',
    title: 'Ready to Audit',
    description: 'Run an audit to analyze text styles, tokens, and typography consistency.',
  },
  'no-tokens': {
    icon: '🎨',
    title: 'No Tokens Detected',
    description: 'This document does not use design tokens yet. Add tokens to text properties to see them here.',
  },
  'no-results': {
    icon: '✨',
    title: 'No Results',
    description: 'Run an audit to see style inventory and token usage.',
  },
  'select-style': {
    icon: '👉',
    title: 'Select a Style',
    description: 'Choose a style from the list to view details and affected layers.',
  },
  'select-token': {
    icon: '👉',
    title: 'Select a Token',
    description: 'Choose a token to view its usage and affected layers.',
  },
};

export default function EmptyStateMessage({
  type,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateMessageProps) {
  const config = emptyStateConfigs[type];
  const displayTitle = title || config?.title || 'No Data';
  const displayDescription = description || config?.description || '';
  const displayIcon = config?.icon || '✨';

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-5xl mb-4">{displayIcon}</div>
      <h3 className="text-lg font-semibold text-figma-text mb-2">{displayTitle}</h3>
      <p className="text-sm text-figma-text-secondary mb-6 max-w-xs">{displayDescription}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="
            px-4 py-2 rounded text-sm font-medium
            bg-figma-bg-brand text-white
            hover:opacity-90
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-figma-bg-brand
          "
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

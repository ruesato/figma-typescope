/**
 * WarningBannerEdgeCases Component
 *
 * Displays edge case warnings and status messages.
 * Used to alert users about:
 * - Stale audit results (document changed)
 * - Network/library access issues
 * - Partial failures or warnings
 * - Missing styles or deleted references
 */

interface WarningBannerEdgeCasesProps {
  type:
    | 'stale-results'
    | 'network-issue'
    | 'missing-libraries'
    | 'partial-failure'
    | 'missing-styles'
    | 'large-document';
  message: string;
  onDismiss?: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

const bannerConfigs: Record<string, { icon: string; bgClass: string; textClass: string }> = {
  'stale-results': {
    icon: '⚠️',
    bgClass: 'bg-yellow-50 border-yellow-200',
    textClass: 'text-yellow-800',
  },
  'network-issue': {
    icon: '🌐',
    bgClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-800',
  },
  'missing-libraries': {
    icon: '📚',
    bgClass: 'bg-orange-50 border-orange-200',
    textClass: 'text-orange-800',
  },
  'partial-failure': {
    icon: '⚡',
    bgClass: 'bg-orange-50 border-orange-200',
    textClass: 'text-orange-800',
  },
  'missing-styles': {
    icon: '❌',
    bgClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-800',
  },
  'large-document': {
    icon: '⏱️',
    bgClass: 'bg-blue-50 border-blue-200',
    textClass: 'text-blue-800',
  },
};

export default function WarningBannerEdgeCases({
  type,
  message,
  onDismiss,
  onAction,
  actionLabel,
}: WarningBannerEdgeCasesProps) {
  const config = bannerConfigs[type];

  return (
    <div className={`${config.bgClass} border rounded p-3 flex items-start gap-3`}>
      <span className="text-lg flex-shrink-0">{config.icon}</span>
      <div className="flex-1">
        <p className={`text-sm ${config.textClass} font-medium`}>{message}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {onAction && actionLabel && (
          <button
            onClick={onAction}
            className={`text-xs font-semibold px-2 py-1 rounded ${config.textClass} hover:opacity-70`}
          >
            {actionLabel}
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className={`text-xs ${config.textClass} hover:opacity-70`}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

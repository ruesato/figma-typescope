/**
 * VersionFooter Component
 *
 * Displays plugin version information and helpful links.
 * Useful for debugging and support requests.
 */

import { getPluginVersion } from '@/ui/utils/version';

interface VersionFooterProps {
  compact?: boolean;
}

export default function VersionFooter({ compact = false }: VersionFooterProps) {
  const version = getPluginVersion();

  if (compact) {
    return (
      <div className="text-xs text-figma-text-secondary text-center py-2 border-t border-figma-border">
        <p>Typescope v{version}</p>
      </div>
    );
  }

  return (
    <div className="border-t border-figma-border p-3 bg-figma-bg-secondary text-xs text-figma-text-secondary">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium text-figma-text">Typescope</p>
          <p>Version {version}</p>
        </div>
      </div>

      <div className="space-y-1">
        <a
          href="https://github.com/ryanuesato/figma-typescope"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-figma-bg-brand hover:underline"
        >
          → View on GitHub
        </a>
        <a
          href="https://github.com/ryanuesato/figma-typescope/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-figma-bg-brand hover:underline"
        >
          → Report Issues
        </a>
      </div>
    </div>
  );
}

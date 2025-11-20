import { useState } from 'react';
import type { TextLayerData } from '@/shared/types';
import LayerItem from './LayerItem';

interface AuditResultsProps {
  textLayers: TextLayerData[];
  onNavigate?: (layerId: string) => void;
}

/**
 * Audit Results Component
 *
 * Displays a list of text layers with filtering and sorting options.
 *
 * @example
 * ```tsx
 * <AuditResults
 *   textLayers={auditResult.textLayers}
 *   onNavigate={navigateToLayer}
 * />
 * ```
 */
export default function AuditResults({
  textLayers,
  onNavigate,
}: AuditResultsProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default');

  // Filter layers by status
  const filteredLayers = textLayers.filter((layer) => {
    if (filterStatus === 'all') return true;
    return layer.styleAssignment.assignmentStatus === filterStatus;
  });

  // Sort layers
  const sortedLayers = [...filteredLayers].sort((a, b) => {
    switch (sortBy) {
      case 'font':
        return a.fontFamily.localeCompare(b.fontFamily);
      case 'size':
        return b.fontSize - a.fontSize;
      case 'status':
        return a.styleAssignment.assignmentStatus.localeCompare(
          b.styleAssignment.assignmentStatus
        );
      default:
        return 0; // Default order
    }
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-figma-border pb-2">
        <h2 className="text-lg font-semibold text-figma-text mb-3">
          Text Layers ({filteredLayers.length})
        </h2>

        {/* Filters and sorting */}
        <div className="flex gap-2 flex-wrap">
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="
              px-2 py-1 text-xs rounded
              bg-figma-bg-secondary border border-figma-border
              text-figma-text
              focus:outline-none focus:ring-2 focus:ring-figma-bg-brand
            "
          >
            <option value="all">All ({textLayers.length})</option>
            <option value="fully-styled">
              Styled (
              {
                textLayers.filter(
                  (l) => l.styleAssignment.assignmentStatus === 'fully-styled'
                ).length
              }
              )
            </option>
            <option value="partially-styled">
              Partial (
              {
                textLayers.filter(
                  (l) =>
                    l.styleAssignment.assignmentStatus === 'partially-styled'
                ).length
              }
              )
            </option>
            <option value="unstyled">
              Unstyled (
              {
                textLayers.filter(
                  (l) => l.styleAssignment.assignmentStatus === 'unstyled'
                ).length
              }
              )
            </option>
          </select>

          {/* Sort by */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="
              px-2 py-1 text-xs rounded
              bg-figma-bg-secondary border border-figma-border
              text-figma-text
              focus:outline-none focus:ring-2 focus:ring-figma-bg-brand
            "
          >
            <option value="default">Default Order</option>
            <option value="font">Sort by Font</option>
            <option value="size">Sort by Size</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sortedLayers.length === 0 ? (
          <div className="text-center py-8 text-figma-text-secondary">
            No layers match the current filter
          </div>
        ) : (
          sortedLayers.map((layer) => (
            <LayerItem key={layer.id} layer={layer} onNavigate={onNavigate} />
          ))
        )}
      </div>
    </div>
  );
}

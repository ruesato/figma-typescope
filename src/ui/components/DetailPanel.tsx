import React, { useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TextLayer, TextStyle, DesignToken } from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

export interface DetailPanelProps {
  /** Selected style or token */
  selectedStyle?: TextStyle | null;
  selectedToken?: DesignToken | null;
  /** All text layers in document */
  allLayers: TextLayer[];
  /** Callback when layer is clicked */
  onLayerSelect?: (layerId: string) => void;
  /** Callback to navigate to layer in canvas */
  onNavigateToLayer?: (layerId: string) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
}

interface LayerGroup {
  pageId: string;
  pageName: string;
  components: ComponentGroup[];
}

interface ComponentGroup {
  componentPath: string | undefined;
  layers: TextLayer[];
}

interface FlattenedItem {
  type: 'page-header' | 'component-header' | 'layer';
  pageId?: string;
  pageName?: string;
  componentPath?: string;
  layer?: TextLayer;
  indentLevel: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for assignment status badge
 */
const getStatusColor = (status: 'fully-styled' | 'partially-styled' | 'unstyled'): string => {
  switch (status) {
    case 'fully-styled':
      return 'bg-green-100 text-green-800';
    case 'partially-styled':
      return 'bg-yellow-100 text-yellow-800';
    case 'unstyled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Get label for assignment status
 */
const getStatusLabel = (status: 'fully-styled' | 'partially-styled' | 'unstyled'): string => {
  switch (status) {
    case 'fully-styled':
      return 'Fully Styled';
    case 'partially-styled':
      return 'Partial';
    case 'unstyled':
      return 'Unstyled';
    default:
      return 'Unknown';
  }
};

/**
 * Get layers that use a specific style
 */
const getLayersForStyle = (layers: TextLayer[], styleId: string): TextLayer[] => {
  return layers.filter((layer) => layer.styleId === styleId);
};

/**
 * Get layers that use a specific token
 */
const getLayersForToken = (layers: TextLayer[], tokenId: string): TextLayer[] => {
  return layers.filter(
    (layer) => layer.tokens && layer.tokens.some((token) => token.tokenId === tokenId)
  );
};

/**
 * Group layers by page and component
 */
const groupLayersByPageAndComponent = (layers: TextLayer[]): LayerGroup[] => {
  const pageMap = new Map<string, ComponentGroup[]>();

  for (const layer of layers) {
    if (!pageMap.has(layer.pageId)) {
      pageMap.set(layer.pageId, []);
    }

    const componentGroups = pageMap.get(layer.pageId)!;
    const componentPath = layer.componentPath || 'Other';
    let componentGroup = componentGroups.find((cg) => cg.componentPath === componentPath);

    if (!componentGroup) {
      componentGroup = {
        componentPath,
        layers: [],
      };
      componentGroups.push(componentGroup);
    }

    componentGroup.layers.push(layer);
  }

  // Convert map to sorted array
  const result: LayerGroup[] = [];
  for (const [pageId, componentGroups] of pageMap.entries()) {
    // Find page name from first layer
    const pageName = layers.find((l) => l.pageId === pageId)?.pageName || pageId;

    // Sort component groups by name
    componentGroups.sort((a, b) => {
      const aName = a.componentPath || '';
      const bName = b.componentPath || '';
      return aName.localeCompare(bName);
    });

    result.push({
      pageId,
      pageName,
      components: componentGroups,
    });
  }

  // Sort by page name
  result.sort((a, b) => a.pageName.localeCompare(b.pageName));

  return result;
};

/**
 * Flatten grouped layers for virtualization
 */
const flattenGroupedLayers = (pageGroups: LayerGroup[]): FlattenedItem[] => {
  const items: FlattenedItem[] = [];

  for (const pageGroup of pageGroups) {
    // Add page header
    items.push({
      type: 'page-header',
      pageId: pageGroup.pageId,
      pageName: pageGroup.pageName,
      indentLevel: 0,
    });

    // Add component groups
    for (const componentGroup of pageGroup.components) {
      items.push({
        type: 'component-header',
        componentPath: componentGroup.componentPath,
        indentLevel: 1,
      });

      // Add layers
      for (const layer of componentGroup.layers) {
        items.push({
          type: 'layer',
          layer,
          indentLevel: 2,
        });
      }
    }
  }

  return items;
};

// ============================================================================
// Row Component (Virtualized)
// ============================================================================

interface DetailRowProps {
  item: FlattenedItem;
  onLayerSelect: (layerId: string) => void;
  onNavigateToLayer: (layerId: string) => void;
}

const DetailRow: React.FC<DetailRowProps> = ({ item, onLayerSelect, onNavigateToLayer }) => {
  if (item.type === 'page-header') {
    return (
      <div className="px-4 py-3 bg-figma-bg-secondary border-b border-figma-border">
        <h3 className="text-sm font-semibold text-figma-text">{item.pageName}</h3>
      </div>
    );
  }

  if (item.type === 'component-header') {
    return (
      <div
        className="px-4 py-2 bg-figma-bg-tertiary border-b border-figma-border"
        style={{ paddingLeft: `${20 + 20}px` }}
      >
        <p className="text-xs font-medium text-figma-text-secondary">
          {item.componentPath || 'Other'}
        </p>
      </div>
    );
  }

  if (item.type === 'layer' && item.layer) {
    const layer = item.layer;
    const statusColor = getStatusColor(layer.assignmentStatus);
    const statusLabel = getStatusLabel(layer.assignmentStatus);

    return (
      <div
        className="px-4 py-3 border-b border-figma-border hover:bg-figma-bg-secondary cursor-pointer transition-colors"
        style={{ paddingLeft: `${20 + 20 + 20}px` }}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Layer Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-figma-text truncate">{layer.name}</h4>
              {!layer.visible && (
                <span className="text-xs text-figma-text-tertiary" title="Hidden layer">
                  👁️‍🗨️
                </span>
              )}
            </div>

            {/* Text Content Preview */}
            {layer.textContent && (
              <p className="text-xs text-figma-text-secondary truncate mb-2">
                "{layer.textContent}"
              </p>
            )}

            {/* Component Path */}
            {layer.componentPath && (
              <p className="text-xs text-figma-text-tertiary mb-2">
                Component: {layer.componentPath}
              </p>
            )}

            {/* Style and Token Info */}
            <div className="flex flex-wrap gap-2 mb-2">
              {/* Style Badge */}
              {layer.styleName && (
                <span className="text-xs px-2 py-1 rounded bg-figma-bg-brand text-figma-color-text-onbrand">
                  {layer.styleName}
                </span>
              )}

              {/* Token Count */}
              {layer.tokens && layer.tokens.length > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                  {layer.tokens.length} token{layer.tokens.length !== 1 ? 's' : ''}
                </span>
              )}

              {/* Status Badge */}
              <span className={`text-xs px-2 py-1 rounded font-medium ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            {/* Overrides Warning */}
            {layer.hasOverrides && (
              <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded mb-2">
                ⚠️ Has overrides
              </p>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={() => onNavigateToLayer(layer.id)}
            className="flex-shrink-0 px-3 py-1 text-xs font-medium rounded bg-figma-bg-brand text-figma-color-text-onbrand hover:opacity-80 transition-opacity whitespace-nowrap"
            title="Navigate to layer in canvas"
          >
            Go to
          </button>
        </div>
      </div>
    );
  }

  return null;
};

// ============================================================================
// Main DetailPanel Component
// ============================================================================

export const DetailPanel: React.FC<DetailPanelProps> = ({
  selectedStyle,
  selectedToken,
  allLayers,
  onLayerSelect,
  onNavigateToLayer,
  isLoading = false,
  error,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Get relevant layers based on selection
  const relevantLayers = useMemo(() => {
    if (selectedStyle) {
      return getLayersForStyle(allLayers, selectedStyle.id);
    } else if (selectedToken) {
      return getLayersForToken(allLayers, selectedToken.id);
    }
    return [];
  }, [selectedStyle, selectedToken, allLayers]);

  // Group layers by page and component
  const pageGroups = useMemo(() => {
    return groupLayersByPageAndComponent(relevantLayers);
  }, [relevantLayers]);

  // Flatten for virtualization
  const flattenedItems = useMemo(() => {
    return flattenGroupedLayers(pageGroups);
  }, [pageGroups]);

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flattenedItems[index];
      if (item.type === 'page-header') return 48;
      if (item.type === 'component-header') return 36;
      return 120; // Layer item with more content
    },
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Render empty state
  if (!isLoading && !selectedStyle && !selectedToken) {
    return (
      <div className="flex flex-col h-full bg-figma-bg">
        <div className="p-4 border-b border-figma-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-figma-text">Details</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-sm text-figma-text-secondary">
              Select a style or token to view details
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-figma-bg">
        <div className="p-4 border-b border-figma-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-figma-text">Details</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 rounded-full animate-spin border-figma-border border-t-figma-bg-brand mx-auto mb-4" />
            <p className="text-sm text-figma-text-secondary">Loading details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col h-full bg-figma-bg">
        <div className="p-4 border-b border-figma-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-figma-text">Details</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-sm text-red-600 mb-2">⚠️ Error loading details</p>
            <p className="text-xs text-figma-text-secondary">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render empty results
  if (relevantLayers.length === 0) {
    return (
      <div className="flex flex-col h-full bg-figma-bg">
        <div className="p-4 border-b border-figma-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-figma-text">
              {selectedStyle ? selectedStyle.name : selectedToken?.name || 'Details'}
            </h2>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-figma-text-secondary hover:text-figma-text transition-colors"
            >
              {isExpanded ? '−' : '+'}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center">
              <p className="text-sm text-figma-text-secondary">
                No layers using this{selectedStyle ? 'style' : 'token'}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render full detail panel with virtualized list
  return (
    <div className="flex flex-col h-full bg-figma-bg">
      {/* Header */}
      <div className="p-4 border-b border-figma-border flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-figma-text">
            {selectedStyle ? selectedStyle.name : selectedToken?.name || 'Details'}
          </h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-figma-text-secondary hover:text-figma-text transition-colors"
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>

        {/* Usage Count */}
        <p className="text-xs text-figma-text-secondary">
          Used by {relevantLayers.length} layer{relevantLayers.length !== 1 ? 's' : ''}
        </p>

        {/* Status Summary */}
        <div className="flex flex-wrap gap-2 mt-2">
          {(() => {
            const fullyStyled = relevantLayers.filter(
              (l) => l.assignmentStatus === 'fully-styled'
            ).length;
            const partiallyStyled = relevantLayers.filter(
              (l) => l.assignmentStatus === 'partially-styled'
            ).length;
            const unstyled = relevantLayers.filter((l) => l.assignmentStatus === 'unstyled').length;

            return (
              <>
                {fullyStyled > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                    ✓ {fullyStyled} Fully styled
                  </span>
                )}
                {partiallyStyled > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                    ~ {partiallyStyled} Partial
                  </span>
                )}
                {unstyled > 0 && (
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                    ✗ {unstyled} Unstyled
                  </span>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Virtualized List */}
      {isExpanded && (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto"
          style={{
            height: 'calc(100% - 120px)',
          }}
        >
          <div
            style={{
              height: `${totalSize}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const item = flattenedItems[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <DetailRow
                    item={item}
                    onLayerSelect={onLayerSelect || (() => {})}
                    onNavigateToLayer={onNavigateToLayer || (() => {})}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailPanel;

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight } from 'lucide-react';
import TokenMetadataCard from './TokenMetadataCard';
import { TokenBadgeList } from './TokenBadge';
import { StylePropertiesPanel } from './StylePropertiesPanel';
import type { TextLayer, TextStyle, DesignToken } from '@/shared/types';
import { OVERSCAN_COUNTS, ScrollPerformanceMonitor } from '@/ui/utils/virtualization';

// ============================================================================
// Types (T124 - Virtualized Detail Panel for 10k+ layers at 60fps)
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
  /** Callback when replace button is clicked */
  onReplaceStyle?: (style: TextStyle, affectedLayerIds: string[]) => void;
  onReplaceToken?: (token: DesignToken, affectedLayerIds: string[]) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Replacement history: original style ID -> { targetStyleId, targetStyleName, count } */
  replacementHistory?: Map<
    string,
    { targetStyleId: string; targetStyleName: string; count: number }
  >;
  /** All styles for looking up replaced target styles */
  allStyles?: TextStyle[];
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
 * Get color class for assignment status badge
 */
const getStatusColor = (status: 'fully-styled' | 'partially-styled' | 'unstyled'): string => {
  switch (status) {
    case 'fully-styled':
      return 'bg-green-100 text-green-800';
    case 'partially-styled':
      return 'bg-red-100 text-red-800'; // Red badge for partial (has overrides)
    case 'unstyled':
      return 'bg-gray-100 text-gray-800'; // Gray for unstyled
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
 * Format property name for display (Phase 6)
 */
const formatPropertyName = (property: string): string => {
  switch (property) {
    case 'fontFamily':
      return 'Font Family';
    case 'fontSize':
      return 'Font Size';
    case 'fontWeight':
      return 'Font Weight';
    case 'lineHeight':
      return 'Line Height';
    case 'letterSpacing':
      return 'Letter Spacing';
    case 'fills':
      return 'Color';
    default:
      return property;
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
        onClick={() => onNavigateToLayer(layer.id)}
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

              {/* Status Badge */}
              <span className={`text-xs px-2 py-1 rounded font-medium ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            {/* Token Badges - Expanded Display */}
            {layer.tokens && layer.tokens.length > 0 && (
              <div className="mt-2">
                <TokenBadgeList tokens={layer.tokens} maxVisible={3} mode="expanded" size="sm" />
              </div>
            )}

            {/* Property Overrides - NEW (Phase 6) */}
            {layer.propertyOverrides && layer.propertyOverrides.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-xs font-medium text-gray-600 mb-1">Overrides:</div>
                {layer.propertyOverrides.map((override, idx) => (
                  <div
                    key={`${override.property}-${idx}`}
                    className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5"
                  >
                    <div className="font-medium text-gray-700 mb-0.5">
                      {formatPropertyName(override.property)}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="text-red-700 line-through">
                        {override.displayStyleValue}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-700 font-semibold">
                        {override.displayOverrideValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Arrow Icon */}
          <div className="flex-shrink-0 text-figma-text-tertiary">
            <ChevronRight size={16} />
          </div>
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
  onReplaceStyle,
  onReplaceToken,
  isLoading = false,
  error,
  replacementHistory,
  allStyles,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const scrollMonitor = useRef(new ScrollPerformanceMonitor());

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

  // Monitor scroll performance for 10k+ layers
  useEffect(() => {
    const container = parentRef.current;
    if (!container || relevantLayers.length < 5000) return;

    const onScroll = () => {
      const fps = scrollMonitor.current.measureFrame();
      if (!scrollMonitor.current.isOptimal() && fps < 50) {
        console.warn(`DetailPanel scroll performance degraded: ${fps}fps for ${relevantLayers.length} layers`);
      }
    };

    container.addEventListener('scroll', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
    };
  }, [relevantLayers.length]);

  // Memoize estimateSize to prevent virtualizer re-creation on every render
  const estimateSize = useCallback((index: number) => {
    const item = flattenedItems[index];
    if (item.type === 'page-header') return 48;
    if (item.type === 'component-header') return 36;
    return 120; // Layer item with more content
  }, [flattenedItems]);

  // Setup virtualizer with enterprise zone optimization for 10k+ layers
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: flattenedItems.length > 5000 ? OVERSCAN_COUNTS.list : 10,
    gap: 0,
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

  // Check if selected style was replaced
  const isStyleReplaced = selectedStyle && replacementHistory?.has(selectedStyle.id);
  const replacementInfo =
    selectedStyle && isStyleReplaced ? replacementHistory?.get(selectedStyle.id) : null;

  // Render empty results (or replaced style info)
  if (relevantLayers.length === 0) {
    return (
      <div className="flex flex-col h-full bg-figma-bg">
        <div className="p-4 border-b border-figma-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2
              className="text-sm font-semibold text-figma-text"
              style={{ opacity: isStyleReplaced ? 0.6 : 1 }}
            >
              {selectedStyle ? selectedStyle.name : selectedToken?.name || 'Details'}
            </h2>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-figma-text-secondary hover:text-figma-text transition-colors"
            >
              {isExpanded ? '−' : '+'}
            </button>
          </div>

          {/* Token Metadata Card - show even when no layers use it */}
          {selectedToken && (
            <div style={{ marginTop: 'var(--figma-space-md)' }}>
              <TokenMetadataCard token={selectedToken} />
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center">
              {isStyleReplaced && replacementInfo ? (
                <>
                  <p className="text-sm text-figma-color-text-secondary mb-2">0 current uses</p>
                  <p className="text-sm font-medium text-figma-color-text">
                    This style was replaced by{' '}
                    <span style={{ fontWeight: 700 }}>{replacementInfo.targetStyleName}</span>
                  </p>
                  <p className="text-xs text-figma-text-secondary mt-2">
                    {replacementInfo.count} instance{replacementInfo.count !== 1 ? 's' : ''} moved
                  </p>
                </>
              ) : (
                <p className="text-sm text-figma-text-secondary">
                  No layers using this {selectedStyle ? 'style' : 'token'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Calculate override count
  const partiallyStyledCount = relevantLayers.filter(
    (l) => l.assignmentStatus === 'partially-styled'
  ).length;

  // Render full detail panel with virtualized list
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header - Fixed at top */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--figma-space-sm)',
          padding: 'var(--figma-space-md)',
          borderBottom: '1px solid var(--figma-color-border)',
        }}
      >
        {/* Title and Replace button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--figma-space-md)',
            position: 'sticky',
            top: 0
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                lineHeight: '28px',
                color: 'var(--figma-color-text)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedStyle ? selectedStyle.name : selectedToken?.name || 'Details'}
            </h2>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--figma-color-text-secondary)',
                margin: '4px 0 0 0',
              }}
            >
              Used in {relevantLayers.length} layer{relevantLayers.length !== 1 ? 's' : ''}
              {partiallyStyledCount > 0 &&
                ` (${partiallyStyledCount} override${partiallyStyledCount !== 1 ? 's' : ''})`}
            </p>
          </div>

          {/* Replace button */}
          {selectedStyle && onReplaceStyle && relevantLayers.length > 0 && (
            <button
              onClick={() => {
                const affectedLayerIds = relevantLayers.map((l) => l.id);
                onReplaceStyle(selectedStyle, affectedLayerIds);
              }}
              style={{
                height: '32px',
                padding: '0 16px',
                border: '1px solid var(--figma-color-border)',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: 'var(--figma-color-text)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Replace style
            </button>
          )}

          {selectedToken && onReplaceToken && relevantLayers.length > 0 && (
            <button
              onClick={() => {
                const affectedLayerIds = relevantLayers.map((l) => l.id);
                onReplaceToken(selectedToken, affectedLayerIds);
              }}
              style={{
                height: '32px',
                padding: '0 16px',
                border: '1px solid var(--figma-color-border)',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: 'var(--figma-color-text)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Replace token
            </button>
          )}
        </div>

        {/* Token Metadata Card */}
        {selectedToken && (
          <div style={{ marginTop: 'var(--figma-space-md)' }}>
            <TokenMetadataCard token={selectedToken} />
          </div>
        )}

        {/* Style Properties Panel - NEW (Phase 5) */}
        {selectedStyle && (
          <div style={{ marginTop: '0' }}>
            <StylePropertiesPanel style={selectedStyle} />
          </div>
        )}

        {/* Layers Section Header */}
        <div style={{ marginTop: 'var(--figma-space-md)' }}>
          <h3
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--figma-color-text)',
              margin: 0,
            }}
          >
            Layers
          </h3>
        </div>
      </div>

      {/* Scrollable layers list */}
      {isExpanded && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            // overflow: 'hidden',
          }}
        >
          <div
            ref={parentRef}
            style={{
              flex: 1,
              overflow: 'auto',
              position: 'relative',
              contain: 'layout style paint',
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
          >
            <div style={{ height: `${totalSize}px`, width: '100%', position: 'relative' }}>
              {virtualItems.map((virtualItem) => {
                const item = flattenedItems[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
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

          {/* Replacement History Section - shown at bottom for styles that received replacements */}
          {selectedStyle &&
            replacementHistory &&
            Array.from(replacementHistory.entries()).some(
              ([_, entry]) => entry.targetStyleId === selectedStyle.id
            ) && (
              <div
                style={{
                  borderTop: '1px solid var(--figma-color-border)',
                  padding: 'var(--figma-space-md)',
                  backgroundColor: 'var(--figma-color-bg-secondary)',
                  flexShrink: 0,
                }}
              >
                <h3
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--figma-color-text)',
                    margin: '0 0 var(--figma-space-sm) 0',
                  }}
                >
                  Replacement History
                </h3>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 'var(--figma-space-sm)' }}
                >
                  {Array.from(replacementHistory.entries())
                    .filter(([_, entry]) => entry.targetStyleId === selectedStyle.id)
                    .map(([originalStyleId, entry]) => {
                      const originalStyle = allStyles?.find((s) => s.id === originalStyleId);
                      return (
                        <div
                          key={originalStyleId}
                          style={{
                            padding: '8px',
                            backgroundColor: 'var(--figma-color-bg)',
                            borderRadius: '4px',
                            fontSize: '11px',
                          }}
                        >
                          <p
                            style={{
                              margin: '0 0 4px 0',
                              color: 'var(--figma-color-text-secondary)',
                            }}
                          >
                            <span
                              style={{
                                textDecoration: 'line-through',
                                color: 'var(--figma-color-text-tertiary)',
                              }}
                            >
                              {originalStyle?.name || originalStyleId}
                            </span>
                            {' → '}
                            <span style={{ fontWeight: 600, color: 'var(--figma-color-text)' }}>
                              {entry.targetStyleName}
                            </span>
                          </p>
                          <p style={{ margin: 0, color: 'var(--figma-color-text-tertiary)' }}>
                            {entry.count} instance{entry.count !== 1 ? 's' : ''} moved
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default DetailPanel;

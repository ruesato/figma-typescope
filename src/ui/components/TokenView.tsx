import React, { useState, useMemo } from 'react';
import TreeView, { TreeNode, DefaultNodeRow, ExpandIcon, UsageBadge } from './TreeView';
import { useFuzzySearch } from '@/ui/hooks/useFuzzySearch';
import type { DesignToken, TextLayer } from '@/shared/types';
import { shouldVirtualize } from '@/ui/utils/virtualization';

// ============================================================================
// Types (T125 - Virtualized Token View with enterprise-scale support)
// ============================================================================

export interface TokenViewProps {
  tokens: DesignToken[];
  allLayers?: TextLayer[];
  onTokenSelect?: (token: DesignToken) => void;
  selectedTokenId?: string;
  isLoading?: boolean;
  error?: string;
  // Filter props (controlled from parent)
  searchQuery?: string;
  sourceFilter?: 'all' | 'local' | 'library';
  typeFilter?: 'all' | 'color' | 'number' | 'string' | 'boolean';
  usageFilter?: 'all' | 'used' | 'unused';
  groupByLibrary?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert RGBA to hex color string
 */
const rgbaToHex = (rgba: { r: number; g: number; b: number; a: number }): string => {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}${toHex(rgba.a)}`;
};

/**
 * Get color value representation for preview
 */
const getColorValue = (token: DesignToken): string | null => {
  const tokenType = token.type as unknown as string;
  if (tokenType.toLowerCase() !== 'color') return null;

  if (typeof token.currentValue === 'string') {
    return token.currentValue;
  }

  if (token.currentValue && typeof token.currentValue === 'object') {
    if ('r' in token.currentValue && 'g' in token.currentValue && 'b' in token.currentValue) {
      return rgbaToHex(token.currentValue as { r: number; g: number; b: number; a: number });
    }
  }

  return null;
};

/**
 * Format token value for display
 */
const formatTokenValue = (token: DesignToken): string => {
  const tokenType = token.type as unknown as string;
  if (tokenType.toLowerCase() === 'color') {
    const color = getColorValue(token);
    return color || 'N/A';
  }

  if (typeof token.currentValue === 'string') {
    return token.currentValue;
  }

  if (typeof token.currentValue === 'number') {
    return token.currentValue.toString();
  }

  if (typeof token.currentValue === 'boolean') {
    return token.currentValue ? 'true' : 'false';
  }

  // Handle objects by converting to JSON string
  if (typeof token.currentValue === 'object' && token.currentValue !== null) {
    try {
      return JSON.stringify(token.currentValue);
    } catch {
      return '[Object]';
    }
  }

  return 'N/A';
};

/**
 * Group tokens by collection name
 */
const groupTokensByCollection = (tokens: DesignToken[]): Map<string, DesignToken[]> => {
  const groups = new Map<string, DesignToken[]>();

  tokens.forEach((token) => {
    const collectionName = token.collectionName || 'Ungrouped';
    if (!groups.has(collectionName)) {
      groups.set(collectionName, []);
    }
    groups.get(collectionName)!.push(token);
  });

  return groups;
};

/**
 * Build tree structure from tokens
 */
const buildTokenTree = (tokens: DesignToken[], groupByCollection: boolean): TreeNode<DesignToken>[] => {
  // If not grouping, return flat list of tokens
  if (!groupByCollection) {
    return tokens.map((token) => ({
      id: token.id,
      name: token.name,
      type: 'token',
      data: token,
      children: [],
      level: 0,
    }));
  }

  // Build grouped tree by collection
  const groupedTokens = groupTokensByCollection(tokens);
  const tree: TreeNode<DesignToken>[] = [];

  for (const [collectionName, collectionTokens] of groupedTokens.entries()) {
    // Create collection group node
    const groupNode: TreeNode<DesignToken> = {
      id: `collection-${collectionName}`,
      name: collectionName,
      type: 'collection',
      children: [],
      level: 0,
      metadata: {
        tokenCount: collectionTokens.length,
      },
    };

    // Add tokens as children
    for (const token of collectionTokens) {
      groupNode.children.push({
        id: token.id,
        name: token.name,
        type: 'token',
        data: token,
        children: [],
        level: 1,
      });
    }

    tree.push(groupNode);
  }

  return tree;
};

// ============================================================================
// Main TokenView Component
// ============================================================================

export const TokenView: React.FC<TokenViewProps> = ({
  tokens = [],
  allLayers = [],
  onTokenSelect,
  selectedTokenId,
  isLoading = false,
  error,
  searchQuery = '',
  sourceFilter = 'all',
  typeFilter = 'all',
  usageFilter = 'all',
  groupByLibrary = true,
}) => {

  // Get unique token types from the dataset
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    tokens.forEach((token) => {
      const type = (token.type as string).toLowerCase();
      types.add(type);
    });
    return Array.from(types).sort();
  }, [tokens]);

  // Apply fuzzy search filtering
  const searchFilteredTokens = useFuzzySearch(
    tokens,
    searchQuery,
    ['name', 'collectionName']
  );

  // Filter tokens based on selected filters and fuzzy search
  const filteredTokens = useMemo(() => {
    return searchFilteredTokens.filter((token) => {
      // Source filter
      if (sourceFilter === 'local') {
        // Local tokens have key starting with 'local/'
        const isLocal = token.key.startsWith('local/');
        if (!isLocal) return false;
      } else if (sourceFilter === 'library') {
        // Library tokens don't have key starting with 'local/'
        const isLibrary = !token.key.startsWith('local/');
        if (!isLibrary) return false;
      }

      // Type filter
      if (typeFilter !== 'all') {
        const tokenType = (token.type as string).toLowerCase();
        if (tokenType !== typeFilter) return false;
      }

      // Usage filter
      if (usageFilter !== 'all') {
        const usageCount = token.usageCount ?? 0;
        if (usageFilter === 'used' && usageCount === 0) return false;
        if (usageFilter === 'unused' && usageCount > 0) return false;
      }

      return true;
    });
  }, [searchFilteredTokens, sourceFilter, typeFilter, usageFilter]);

  // Build tree structure from filtered tokens
  const treeNodes = useMemo(() => buildTokenTree(filteredTokens, groupByLibrary), [filteredTokens, groupByLibrary]);

  // Track expanded state for tree nodes
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    treeNodes.forEach((node) => expanded.add(node.id));
    return expanded;
  });

  // Update expanded state when tree structure changes (to ensure all collections start expanded)
  useMemo(() => {
    setExpandedIds((prevExpanded) => {
      const newExpanded = new Set(prevExpanded);
      treeNodes.forEach((node) => newExpanded.add(node.id));
      return newExpanded;
    });
  }, [treeNodes]);

  // Check if virtualization is needed for large token lists
  const shouldUseVirtTokens = shouldVirtualize(filteredTokens.length, 'list');

  // Handle node selection
  const handleNodeSelect = (node: TreeNode<DesignToken>) => {
    if (node.type === 'token' && node.data && onTokenSelect) {
      onTokenSelect(node.data);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-figma-bg">
        <div className="w-8 h-8 border-4 rounded-full animate-spin border-figma-border border-t-figma-bg-brand" />
        <p className="mt-4 text-figma-text-secondary">Loading tokens...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-figma-bg">
        <div className="text-3xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-figma-text">Error Loading Tokens</h3>
        <p className="mt-2 text-center text-figma-text-secondary">{error}</p>
      </div>
    );
  }

  // Render empty state
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-figma-bg">
        <div className="text-5xl mb-4">✨</div>
        <h3 className="text-lg font-semibold text-figma-text">No Tokens Found</h3>
        <p className="mt-2 text-center text-figma-text-secondary">
          Design tokens from your file will appear here. Make sure your document has design
          variables configured.
        </p>
      </div>
    );
  }

  return (
    <TreeView
      key={`token-view-${typeFilter}-${sourceFilter}-${searchQuery}`}
      nodes={treeNodes}
      searchEnabled={false}
      selectedId={selectedTokenId}
      onNodeSelect={handleNodeSelect}
      expandedIds={expandedIds}
      onExpandedChange={setExpandedIds}
      renderNode={(node, options) => {
        // Render collection group header
        if (node.type === 'collection') {
          return (
            <DefaultNodeRow
              onClick={options.toggleExpansion}
              leftContent={
                <div className="flex items-center gap-2">
                  <ExpandIcon isExpanded={options.isExpanded} />
                </div>
              }
              rightContent={
                <span className="text-xs text-figma-text-tertiary">
                  {String(node.metadata?.tokenCount ?? 0)}
                </span>
              }
            >
              <span className="text-sm font-semibold" style={{ color: 'inherit' }}>{node.name}</span>
            </DefaultNodeRow>
          );
        }

        // Render token row
        if (node.type === 'token' && node.data) {
          const token = node.data;
          const colorValue = getColorValue(token);
          const displayValue = formatTokenValue(token);

          return (
            <DefaultNodeRow
              onClick={options.handleSelect}
              isSelected={options.isSelected}
              className="animate-in fade-in slide-in-from-left-4 duration-150"
              leftContent={
                <div style={{ marginLeft: `${(node.level) * 20}px` }} />
              }
              rightContent={
                <div className="flex items-center gap-2">
                  {/* Show color swatch for color tokens instead of hex value */}
                  {colorValue ? (
                    <div
                      className="w-4 h-4 rounded border border-figma-border flex-shrink-0"
                      style={{ backgroundColor: colorValue }}
                      title={colorValue}
                    />
                  ) : (
                    <span
                      className="text-sm font-mono truncate max-w-xs"
                      style={{
                        color: options.isSelected ? 'var(--figma-color-text-onbrand)' : 'var(--figma-color-text-secondary)',
                        opacity: options.isSelected ? 0.9 : 1
                      }}
                      title={displayValue}
                    >
                      {displayValue}
                    </span>
                  )}
                  {(token.usageCount ?? 0) > 0 && (
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        backgroundColor: options.isSelected ? 'rgba(255,255,255,0.2)' : 'var(--figma-color-bg-brand)',
                        color: options.isSelected ? 'var(--figma-color-text-onbrand)' : 'var(--figma-color-text-onbrand)'
                      }}
                    >
                      {token.usageCount ?? 0}
                    </span>
                  )}
                </div>
              }
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'inherit' }}>{token.name}</div>
                <div className="flex gap-2 mt-1">
                  <span
                    className="text-xs"
                    style={{
                      color: options.isSelected ? 'var(--figma-color-text-onbrand)' : 'var(--figma-color-text-tertiary)',
                      opacity: options.isSelected ? 0.8 : 1
                    }}
                  >
                    {String(token.resolvedType || token.type || 'unknown')}
                  </span>
                  {token.isAlias && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: options.isSelected ? 'rgba(255,255,255,0.2)' : 'var(--figma-color-bg-tertiary)',
                        color: 'inherit'
                      }}
                    >
                      alias
                    </span>
                  )}
                </div>
              </div>
            </DefaultNodeRow>
          );
        }

        return null;
      }}
      renderFooter={() => (
        <div className="p-3 text-xs bg-figma-bg-secondary text-figma-text-tertiary">
          <div className="flex flex-col gap-2">
            <div className="text-center">
              Showing {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}
              {filteredTokens.length !== tokens.length && ` (filtered from ${tokens.length})`}
              {shouldUseVirtTokens && ' • virtualized'}
            </div>
            <div className="flex flex-wrap gap-2 justify-center text-figma-text-secondary text-xs">
              <span title="Expand or collapse token group">
                <kbd className="px-2 py-0.5 rounded bg-figma-bg-tertiary">Space</kbd> to expand
              </span>
              <span>•</span>
              <span title="Select token to view details">
                <kbd className="px-2 py-0.5 rounded bg-figma-bg-tertiary">Enter</kbd> to select
              </span>
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default TokenView;

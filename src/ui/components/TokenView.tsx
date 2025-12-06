import React, { useMemo } from 'react';
import TreeView, { TreeNode, DefaultNodeRow, ExpandIcon, UsageBadge } from './TreeView';
import type { DesignToken, TextLayer } from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

export interface TokenViewProps {
  tokens: DesignToken[];
  allLayers?: TextLayer[];
  onTokenSelect?: (token: DesignToken) => void;
  selectedTokenId?: string;
  isLoading?: boolean;
  error?: string;
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
  if (tokenType !== 'COLOR') return null;

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
  if (tokenType === 'COLOR') {
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
const buildTokenTree = (tokens: DesignToken[]): TreeNode<DesignToken>[] => {
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
}) => {
  // Build tree structure
  const treeNodes = useMemo(() => buildTokenTree(tokens), [tokens]);

  // Initialize all collection nodes as expanded
  const defaultExpandedIds = useMemo(() => {
    const expanded = new Set<string>();
    treeNodes.forEach((node) => expanded.add(node.id));
    return expanded;
  }, [treeNodes]);

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
      nodes={treeNodes}
      searchEnabled={true}
      searchPlaceholder="Search tokens..."
      selectedId={selectedTokenId}
      onNodeSelect={handleNodeSelect}
      defaultExpandedIds={defaultExpandedIds}
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
                  {node.metadata?.tokenCount || 0}
                </span>
              }
            >
              <span className="text-sm font-semibold text-figma-text">{node.name}</span>
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
                <div style={{ marginLeft: `${(node.level) * 20}px` }} className="flex items-center gap-3">
                  {/* Color Preview (if color token) */}
                  {colorValue && (
                    <div
                      className="w-5 h-5 rounded border border-figma-border flex-shrink-0"
                      style={{ backgroundColor: colorValue }}
                      title={colorValue}
                    />
                  )}
                </div>
              }
              rightContent={
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-mono truncate max-w-xs text-figma-text-secondary"
                    title={displayValue}
                  >
                    {displayValue}
                  </span>
                  <UsageBadge count={token.usageCount} variant="brand" />
                </div>
              }
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-figma-text">{token.name}</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-figma-text-tertiary">{token.resolvedType}</span>
                  {token.isAlias && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-figma-bg-tertiary text-figma-text">
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
              Showing {tokens.length} token{tokens.length !== 1 ? 's' : ''}
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

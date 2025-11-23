import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DesignToken } from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

export interface TokenViewProps {
  tokens: DesignToken[];
  onTokenSelect?: (token: DesignToken) => void;
  isLoading?: boolean;
  error?: string;
}

interface FlattenedItem {
  type: 'group-header' | 'token';
  groupName?: string;
  token?: DesignToken;
  indentLevel: number;
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
 * Filter tokens and groups based on search query
 */
const filterTokens = (tokens: DesignToken[], query: string): DesignToken[] => {
  if (!query.trim()) return tokens;

  const lowerQuery = query.toLowerCase();
  return tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(lowerQuery) ||
      token.collectionName.toLowerCase().includes(lowerQuery)
  );
};

// ============================================================================
// TokenRow Component (virtualized row)
// ============================================================================

interface TokenRowProps {
  item: FlattenedItem;
  groupExpandState: Map<string, boolean>;
  onGroupToggle: (groupName: string) => void;
  onTokenSelect: (token: DesignToken) => void;
}

const TokenRow: React.FC<TokenRowProps> = ({
  item,
  groupExpandState,
  onGroupToggle,
  onTokenSelect,
}) => {
  if (item.type === 'group-header') {
    const groupName = item.groupName!;
    const isExpanded = groupExpandState.get(groupName) ?? true;

    return (
      <div
        className="flex items-center px-4 py-3 cursor-pointer select-none hover:bg-figma-color-bg-secondary border-b border-figma-color-border"
        onClick={() => onGroupToggle(groupName)}
      >
        <div
          className="mr-2 flex-shrink-0 transition-transform duration-200"
          style={{
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 6L8 9L11 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-sm font-semibold text-figma-color-text">{groupName}</span>
      </div>
    );
  }

  if (item.type === 'token' && item.token) {
    const token = item.token;
    const colorValue = getColorValue(token);
    const displayValue = formatTokenValue(token);

    return (
      <div
        className="flex items-center px-4 py-3 cursor-pointer select-none hover:bg-figma-color-bg-secondary border-b border-figma-color-border animate-in fade-in slide-in-from-left-4 duration-150"
        onClick={() => onTokenSelect(token)}
      >
        <div style={{ marginLeft: `${(item.indentLevel + 1) * 20}px` }} className="flex-1">
          <div className="flex items-center gap-3">
            {/* Color Preview (if color token) */}
            {colorValue && (
              <div
                className="w-5 h-5 rounded border border-figma-color-border flex-shrink-0"
                style={{ backgroundColor: colorValue }}
                title={colorValue}
              />
            )}

            {/* Token Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-figma-color-text">{token.name}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-figma-color-text-tertiary">{token.resolvedType}</span>
                {token.isAlias && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-figma-color-bg-tertiary text-figma-color-text">
                    alias
                  </span>
                )}
              </div>
            </div>

            {/* Token Value */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className="text-sm font-mono truncate max-w-xs text-figma-color-text-secondary"
                title={displayValue}
              >
                {displayValue}
              </span>

              {/* Usage Count Badge */}
              {token.usageCount > 0 && (
                <span className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 bg-figma-color-bg-brand text-figma-color-text-onbrand">
                  {token.usageCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// ============================================================================
// Main TokenView Component
// ============================================================================

export const TokenView: React.FC<TokenViewProps> = ({
  tokens = [],
  onTokenSelect,
  isLoading = false,
  error,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupExpandState, setGroupExpandState] = useState<Map<string, boolean>>(new Map());
  const parentRef = useRef<HTMLDivElement>(null);

  // Filter tokens based on search
  const filteredTokens = useMemo(() => filterTokens(tokens, searchQuery), [tokens, searchQuery]);

  // Group filtered tokens by collection
  const groupedTokens = useMemo(() => {
    const groups = groupTokensByCollection(filteredTokens);
    const groupMap = new Map<string, boolean>();

    groups.forEach((_, name) => {
      // Initialize expansion state if not exists
      if (!groupExpandState.has(name)) {
        groupMap.set(name, true);
      } else {
        groupMap.set(name, groupExpandState.get(name)!);
      }
    });

    return { groups, expandState: groupMap };
  }, [filteredTokens, groupExpandState]);

  // Flatten grouped tokens for virtualization
  const flattenedItems = useMemo((): FlattenedItem[] => {
    const items: FlattenedItem[] = [];

    Array.from(groupedTokens.groups.entries()).forEach(([groupName, groupTokens]) => {
      items.push({
        type: 'group-header',
        groupName,
        indentLevel: 0,
      });

      if (groupExpandState.get(groupName) ?? true) {
        groupTokens.forEach((token) => {
          items.push({
            type: 'token',
            token,
            indentLevel: 0,
          });
        });
      }
    });

    return items;
  }, [groupedTokens, groupExpandState]);

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flattenedItems[index];
      return item?.type === 'group-header' ? 44 : 72;
    },
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Callbacks
  const handleGroupToggle = useCallback((groupName: string) => {
    setGroupExpandState((prev) => {
      const newState = new Map(prev);
      newState.set(groupName, !newState.get(groupName));
      return newState;
    });
  }, []);

  const handleTokenSelect = useCallback(
    (token: DesignToken) => {
      onTokenSelect?.(token);
    },
    [onTokenSelect]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-figma-color-bg">
        <div className="w-8 h-8 border-4 rounded-full animate-spin border-figma-color-border border-t-figma-color-bg-brand" />
        <p className="mt-4 text-figma-color-text-secondary">Loading tokens...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-figma-color-bg">
        <div className="text-3xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-figma-color-text">Error Loading Tokens</h3>
        <p className="mt-2 text-center text-figma-color-text-secondary">{error}</p>
      </div>
    );
  }

  // Render empty state
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-figma-color-bg">
        <div className="text-5xl mb-4">✨</div>
        <h3 className="text-lg font-semibold text-figma-color-text">No Tokens Found</h3>
        <p className="mt-2 text-center text-figma-color-text-secondary">
          Design tokens from your file will appear here. Make sure your document has design
          variables configured.
        </p>
      </div>
    );
  }

  // Render empty search results
  if (searchQuery && filteredTokens.length === 0) {
    return (
      <div className="flex flex-col h-full bg-figma-color-bg">
        {/* Search Input */}
        <div className="p-4 border-b border-figma-color-border">
          <div className="relative">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-figma-color-text-tertiary"
            >
              <path
                d="M8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17 17L12.5 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 bg-figma-color-bg-secondary border border-figma-color-border rounded text-figma-color-text placeholder-figma-color-text-tertiary"
            />
          </div>
        </div>

        {/* Empty Search Results */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-figma-color-text">No Matching Tokens</h3>
          <p className="mt-2 text-center text-figma-color-text-secondary">
            Try adjusting your search query.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-figma-color-bg">
      {/* Search Input */}
      <div className="p-4 border-b border-figma-color-border flex-shrink-0">
        <div className="relative">
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-figma-color-text-tertiary"
          >
            <path
              d="M8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M17 17L12.5 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 bg-figma-color-bg-secondary border border-figma-color-border rounded text-figma-color-text placeholder-figma-color-text-tertiary"
          />
        </div>
      </div>

      {/* Token List (Virtualized) */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{
          height: 'calc(100% - 60px)',
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
                <TokenRow
                  item={item}
                  groupExpandState={groupExpandState}
                  onGroupToggle={handleGroupToggle}
                  onTokenSelect={handleTokenSelect}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      {filteredTokens.length > 0 && (
        <div className="p-3 text-xs text-center bg-figma-color-bg-secondary text-figma-color-text-tertiary border-t border-figma-color-border flex-shrink-0">
          Showing {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}
          {searchQuery && ` (filtered from ${tokens.length})`}
        </div>
      )}
    </div>
  );
};

export default TokenView;

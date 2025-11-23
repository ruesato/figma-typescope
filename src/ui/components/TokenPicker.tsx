import React, { useState, useMemo } from 'react';
import type { DesignToken } from '@/shared/types';

/**
 * TokenPicker Component
 *
 * Modal dialog for selecting a target token for replacement operations.
 * Groups tokens by collection, provides search, and shows token metadata.
 */

// ============================================================================
// Types
// ============================================================================

export interface TokenPickerProps {
  isOpen: boolean;
  tokens: DesignToken[];
  currentTokenId?: string; // Highlighted token (for context)
  onSelect: (token: DesignToken) => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

// ============================================================================
// TokenPicker Component
// ============================================================================

export const TokenPicker: React.FC<TokenPickerProps> = ({
  isOpen,
  tokens,
  currentTokenId,
  onSelect,
  onCancel,
  title = 'Select Target Token',
  description = 'Choose the token to replace with',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [selectedToken, setSelectedToken] = useState<DesignToken | null>(null);

  // Filter tokens based on search and collection
  const filteredTokens = useMemo(() => {
    let filtered = tokens;

    // Filter by collection
    if (selectedCollection !== 'all') {
      filtered = filtered.filter((token) => token.collectionId === selectedCollection);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((token) => token.name.toLowerCase().includes(query));
    }

    return filtered;
  }, [tokens, selectedCollection, searchQuery]);

  // Group tokens by collection
  const tokensByCollection = useMemo(() => {
    const grouped = new Map<string, DesignToken[]>();

    for (const token of filteredTokens) {
      const collectionId = token.collectionId || 'default';
      if (!grouped.has(collectionId)) {
        grouped.set(collectionId, []);
      }
      grouped.get(collectionId)!.push(token);
    }

    return grouped;
  }, [filteredTokens]);

  // Get unique collections
  const collections = useMemo(() => {
    const unique = new Map<string, string>();
    for (const token of tokens) {
      if (!unique.has(token.collectionId)) {
        unique.set(token.collectionId, token.collectionName);
      }
    }
    return Array.from(unique.entries());
  }, [tokens]);

  const handleSelect = () => {
    if (selectedToken) {
      onSelect(selectedToken);
      setSelectedToken(null);
      setSearchQuery('');
      setSelectedCollection('all');
    }
  };

  const handleCancel = () => {
    setSelectedToken(null);
    setSearchQuery('');
    setSelectedCollection('all');
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSelect();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-figma-color-bg rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-figma-color-border">
          <h2 className="text-xl font-semibold text-figma-color-text">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-figma-color-text-secondary">{description}</p>
          )}
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-figma-color-border space-y-3">
          {/* Search */}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-2 bg-figma-color-bg-secondary border border-figma-color-border rounded text-figma-color-text placeholder-figma-color-text-tertiary focus:outline-none focus:ring-2 focus:ring-figma-color-bg-brand"
              autoFocus
            />
          </div>

          {/* Collection Filter */}
          {collections.length > 0 && (
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full px-3 py-2 bg-figma-color-bg-secondary border border-figma-color-border rounded text-figma-color-text focus:outline-none focus:ring-2 focus:ring-figma-color-bg-brand"
            >
              <option value="all">All Collections ({tokens.length})</option>
              {collections.map(([id, name]) => {
                const count = tokens.filter((t) => t.collectionId === id).length;
                return (
                  <option key={id} value={id}>
                    {name} ({count})
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-y-auto">
          {filteredTokens.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-figma-color-text-tertiary">No tokens found</p>
            </div>
          ) : (
            <div>
              {Array.from(tokensByCollection.entries()).map(([collectionId, collectionTokens]) => {
                const collectionName =
                  collections.find(([id]) => id === collectionId)?.[1] || collectionId;

                return (
                  <div key={collectionId}>
                    {/* Collection Header */}
                    <div className="px-4 py-2 bg-figma-color-bg-secondary border-b border-figma-color-border sticky top-0">
                      <p className="text-xs font-semibold text-figma-color-text-secondary uppercase tracking-wide">
                        {collectionName} ({collectionTokens.length})
                      </p>
                    </div>

                    {/* Token Items */}
                    {collectionTokens.map((token) => (
                      <div
                        key={token.id}
                        onClick={() => setSelectedToken(token)}
                        className={`px-4 py-3 border-b border-figma-color-border cursor-pointer transition-colors ${
                          selectedToken?.id === token.id
                            ? 'bg-figma-color-bg-brand bg-opacity-20'
                            : 'hover:bg-figma-color-bg-secondary'
                        } ${currentTokenId === token.id ? 'ring-2 ring-figma-color-bg-warning' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-figma-color-text truncate">
                              {token.name}
                            </p>
                            <p className="text-xs text-figma-color-text-secondary mt-1">
                              {token.type || 'custom'} • {token.collectionName}
                            </p>
                          </div>

                          {/* Token Value Preview */}
                          <div className="text-right">
                            {token.type === 'color' && typeof token.value === 'string' && (
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded border border-figma-color-border"
                                  style={{
                                    backgroundColor: token.value.startsWith('#')
                                      ? token.value
                                      : token.value,
                                  }}
                                />
                                <span className="text-xs text-figma-color-text-secondary font-mono">
                                  {token.value}
                                </span>
                              </div>
                            )}
                            {token.type !== 'color' && (
                              <span className="text-xs text-figma-color-text-secondary font-mono">
                                {String(token.value).slice(0, 20)}
                                {String(token.value).length > 20 ? '...' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Usage Count */}
                        {token.usageCount > 0 && (
                          <div className="mt-2 text-xs text-figma-color-text-tertiary">
                            Used in {token.usageCount} layer{token.usageCount !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-figma-color-border flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-figma-color-bg-secondary border border-figma-color-border rounded text-figma-color-text hover:bg-figma-color-bg-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedToken}
            className="px-4 py-2 bg-figma-color-bg-brand text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select Token
          </button>
        </div>
      </div>
    </div>
  );
};

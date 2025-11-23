import React, { useState, useMemo } from 'react';
import type { TextStyle, LibrarySource } from '@/shared/types';

/**
 * StylePicker Component
 *
 * Modal dialog for selecting a target style for replacement operations.
 * Groups styles by library, provides search, and shows style metadata.
 */

// ============================================================================
// Types
// ============================================================================

export interface StylePickerProps {
  isOpen: boolean;
  styles: TextStyle[];
  libraries: LibrarySource[];
  currentStyleId?: string; // Highlighted style (for context)
  onSelect: (style: TextStyle) => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

// ============================================================================
// StylePicker Component
// ============================================================================

export const StylePicker: React.FC<StylePickerProps> = ({
  isOpen,
  styles,
  libraries,
  currentStyleId,
  onSelect,
  onCancel,
  title = 'Select Target Style',
  description = 'Choose the style to replace with',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState<string>('all');
  const [selectedStyle, setSelectedStyle] = useState<TextStyle | null>(null);

  // Filter styles based on search and library
  const filteredStyles = useMemo(() => {
    let filtered = styles;

    // Filter by library
    if (selectedLibrary !== 'all') {
      filtered = filtered.filter((style) => style.libraryId === selectedLibrary);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((style) => style.name.toLowerCase().includes(query));
    }

    return filtered;
  }, [styles, selectedLibrary, searchQuery]);

  // Group styles by library
  const stylesByLibrary = useMemo(() => {
    const grouped = new Map<string, TextStyle[]>();

    for (const style of filteredStyles) {
      const libraryId = style.libraryId || 'local';
      if (!grouped.has(libraryId)) {
        grouped.set(libraryId, []);
      }
      grouped.get(libraryId)!.push(style);
    }

    return grouped;
  }, [filteredStyles]);

  const handleSelect = () => {
    if (selectedStyle) {
      onSelect(selectedStyle);
      setSelectedStyle(null);
      setSearchQuery('');
    }
  };

  const handleCancel = () => {
    setSelectedStyle(null);
    setSearchQuery('');
    onCancel();
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
              placeholder="Search styles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-figma-color-bg-secondary border border-figma-color-border rounded text-figma-color-text placeholder-figma-color-text-tertiary focus:outline-none focus:ring-2 focus:ring-figma-color-bg-brand"
            />
          </div>

          {/* Library Filter */}
          <select
            value={selectedLibrary}
            onChange={(e) => setSelectedLibrary(e.target.value)}
            className="w-full px-3 py-2 bg-figma-color-bg-secondary border border-figma-color-border rounded text-figma-color-text focus:outline-none focus:ring-2 focus:ring-figma-color-bg-brand"
          >
            <option value="all">All Libraries ({styles.length})</option>
            {libraries.map((library) => (
              <option key={library.id} value={library.id}>
                {library.name} ({library.styleCount})
              </option>
            ))}
          </select>
        </div>

        {/* Style List */}
        <div className="flex-1 overflow-y-auto p-4">
          {stylesByLibrary.size === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-figma-color-text-secondary">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm">No styles found</p>
              {searchQuery && <p className="text-xs mt-1">Try adjusting your search</p>}
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(stylesByLibrary.entries()).map(([libraryId, libraryStyles]) => {
                const library = libraries.find((lib) => lib.id === libraryId);
                return (
                  <div key={libraryId}>
                    {/* Library Header */}
                    <h3 className="text-sm font-semibold text-figma-color-text mb-2">
                      {library?.name || 'Unknown Library'} ({libraryStyles.length})
                    </h3>

                    {/* Styles */}
                    <div className="space-y-1">
                      {libraryStyles.map((style) => {
                        const isSelected = selectedStyle?.id === style.id;
                        const isCurrent = style.id === currentStyleId;

                        return (
                          <button
                            key={style.id}
                            onClick={() => setSelectedStyle(style)}
                            className={`
                              w-full text-left px-3 py-2 rounded transition-colors
                              ${
                                isSelected
                                  ? 'bg-figma-color-bg-brand text-figma-color-text-onbrand'
                                  : isCurrent
                                    ? 'bg-figma-color-bg-tertiary text-figma-color-text'
                                    : 'hover:bg-figma-color-bg-secondary text-figma-color-text'
                              }
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate">{style.name}</span>
                              {isCurrent && (
                                <span className="text-xs px-2 py-0.5 rounded bg-figma-color-bg-secondary text-figma-color-text-secondary ml-2">
                                  Current
                                </span>
                              )}
                              {style.usageCount > 0 && !isCurrent && (
                                <span className="text-xs px-2 py-0.5 rounded bg-figma-color-bg-tertiary text-figma-color-text-secondary ml-2">
                                  {style.usageCount} uses
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-figma-color-border flex items-center justify-between">
          <div className="text-sm text-figma-color-text-secondary">
            {selectedStyle ? (
              <>
                Selected:{' '}
                <span className="font-medium text-figma-color-text">{selectedStyle.name}</span>
              </>
            ) : (
              'Select a style to continue'
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded bg-figma-color-bg-secondary hover:bg-figma-color-bg-tertiary text-figma-color-text font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              disabled={!selectedStyle}
              className={`
                px-4 py-2 rounded font-medium transition-colors
                ${
                  selectedStyle
                    ? 'bg-figma-color-bg-brand hover:bg-figma-color-bg-brand-hover text-figma-color-text-onbrand'
                    : 'bg-figma-color-bg-tertiary text-figma-color-text-tertiary cursor-not-allowed'
                }
              `}
            >
              Select Style
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StylePicker;

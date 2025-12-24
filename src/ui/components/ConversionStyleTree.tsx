import { useState, useMemo } from 'react';
import { CheckSquare, Square, Type } from 'lucide-react';
import FilterToolbar from './FilterToolbar';
import type { TextStyle, LibrarySource } from '@/shared/types';

export interface ConversionStyleTreeProps {
  /** All text styles (will be filtered to show only remote styles) */
  styles: TextStyle[];
  /** Library sources for display */
  libraries: LibrarySource[];
  /** Set of selected style IDs */
  selectedStyleIds: Set<string>;
  /** Callback when selection changes */
  onSelectionChange: (selectedIds: Set<string>) => void;
}

/**
 * Conversion Style Tree Component
 *
 * Tree view with checkboxes for selecting remote text styles to convert.
 * Filters to show ONLY remote styles (sourceType !== 'local').
 *
 * Features:
 * - Multi-select with checkboxes
 * - "Select All" / "Deselect All" buttons
 * - FilterToolbar for search and filtering
 * - Library grouping support
 */
export default function ConversionStyleTree({
  styles,
  libraries,
  selectedStyleIds,
  onSelectionChange,
}: ConversionStyleTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'library'>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [groupByLibrary, setGroupByLibrary] = useState(true);

  // Filter to show ONLY remote styles
  const remoteStyles = useMemo(() => {
    return styles.filter((style) => style.sourceType !== 'local');
  }, [styles]);

  // Apply filters to remote styles
  const filteredStyles = useMemo(() => {
    let result = remoteStyles;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((style) => style.name.toLowerCase().includes(query));
    }

    // Source filter (for remote styles, only 'library' makes sense)
    if (sourceFilter === 'local') {
      result = []; // No local styles in this view
    }

    // Usage filter
    if (usageFilter === 'used') {
      result = result.filter((style) => style.usageCount > 0);
    } else if (usageFilter === 'unused') {
      result = result.filter((style) => style.usageCount === 0);
    }

    return result;
  }, [remoteStyles, searchQuery, sourceFilter, usageFilter]);

  // Group styles by library
  const groupedStyles = useMemo(() => {
    if (!groupByLibrary) {
      return [{ libraryName: 'All Styles', styles: filteredStyles }];
    }

    const groups = new Map<string, TextStyle[]>();

    for (const style of filteredStyles) {
      const libraryName = style.libraryName || 'Unknown Library';
      if (!groups.has(libraryName)) {
        groups.set(libraryName, []);
      }
      groups.get(libraryName)!.push(style);
    }

    return Array.from(groups.entries())
      .map(([libraryName, styles]) => ({ libraryName, styles }))
      .sort((a, b) => a.libraryName.localeCompare(b.libraryName));
  }, [filteredStyles, groupByLibrary]);

  // Select/deselect all
  const handleSelectAll = () => {
    const allIds = new Set(filteredStyles.map((s) => s.id));
    onSelectionChange(allIds);
  };

  const handleDeselectAll = () => {
    onSelectionChange(new Set());
  };

  // Toggle individual style
  const handleToggleStyle = (styleId: string) => {
    const newSelection = new Set(selectedStyleIds);
    if (newSelection.has(styleId)) {
      newSelection.delete(styleId);
    } else {
      newSelection.add(styleId);
    }
    onSelectionChange(newSelection);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with selection controls */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--figma-color-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--figma-color-text)',
              margin: 0,
            }}
          >
            Select Styles
          </h3>
          <div style={{ fontSize: '11px', color: 'var(--figma-color-text-secondary)' }}>
            {selectedStyleIds.size} of {filteredStyles.length} selected
          </div>
        </div>

        {/* Select All / Deselect All buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSelectAll}
            disabled={filteredStyles.length === 0}
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 500,
              border: '1px solid var(--figma-color-border)',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--figma-color-text)',
              cursor: filteredStyles.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredStyles.length === 0 ? 0.5 : 1,
            }}
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            disabled={selectedStyleIds.size === 0}
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 500,
              border: '1px solid var(--figma-color-border)',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--figma-color-text)',
              cursor: selectedStyleIds.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedStyleIds.size === 0 ? 0.5 : 1,
            }}
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--figma-color-border)' }}>
        <FilterToolbar
          type="styles"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search remote styles..."
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          usageFilter={usageFilter}
          onUsageFilterChange={setUsageFilter}
          groupByLibrary={groupByLibrary}
          onGroupByLibraryChange={setGroupByLibrary}
        />
      </div>

      {/* Styles List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {filteredStyles.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <Type size={48} style={{ color: 'var(--figma-color-text-tertiary)', marginBottom: '16px' }} />
            <p
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--figma-color-text)',
                marginBottom: '8px',
              }}
            >
              No remote styles found
            </p>
            <p
              style={{
                fontSize: '11px',
                color: 'var(--figma-color-text-secondary)',
                margin: 0,
              }}
            >
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'All text styles in this document are local'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: groupByLibrary ? '24px' : '4px' }}>
            {groupedStyles.map((group) => (
              <div key={group.libraryName}>
                {groupByLibrary && (
                  <h4
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--figma-color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                    }}
                  >
                    {group.libraryName} ({group.styles.length})
                  </h4>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {group.styles.map((style) => {
                    const isSelected = selectedStyleIds.has(style.id);
                    return (
                      <button
                        key={style.id}
                        onClick={() => handleToggleStyle(style.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          border: '1px solid var(--figma-color-border)',
                          borderRadius: '6px',
                          backgroundColor: isSelected
                            ? 'var(--figma-color-bg-brand-tertiary)'
                            : 'var(--figma-color-bg)',
                          color: 'var(--figma-color-text)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'var(--figma-color-bg)';
                          }
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare
                            size={16}
                            style={{ color: 'var(--figma-color-bg-brand)', flexShrink: 0 }}
                          />
                        ) : (
                          <Square
                            size={16}
                            style={{ color: 'var(--figma-color-text-tertiary)', flexShrink: 0 }}
                          />
                        )}
                        <Type size={14} style={{ color: 'var(--figma-color-text-secondary)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: isSelected ? 500 : 400,
                              color: 'var(--figma-color-text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {style.name}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: 'var(--figma-color-text-tertiary)',
                              marginTop: '2px',
                            }}
                          >
                            {style.usageCount} layer{style.usageCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

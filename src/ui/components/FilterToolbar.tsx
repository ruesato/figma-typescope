import { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type UsageFilter = 'all' | 'used' | 'unused';

interface BaseToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  usageFilter?: UsageFilter;
  onUsageFilterChange?: (filter: UsageFilter) => void;
}

interface StylesToolbarProps extends BaseToolbarProps {
  type: 'styles';
  sourceFilter: 'all' | 'local' | 'library';
  onSourceFilterChange: (filter: 'all' | 'local' | 'library') => void;
  groupByLibrary: boolean;
  onGroupByLibraryChange: (checked: boolean) => void;
}

interface TokensToolbarProps extends BaseToolbarProps {
  type: 'tokens';
  sourceFilter: 'all' | 'local' | 'library';
  onSourceFilterChange: (filter: 'all' | 'local' | 'library') => void;
  typeFilter: 'all' | 'color' | 'number' | 'string' | 'boolean';
  onTypeFilterChange: (filter: 'all' | 'color' | 'number' | 'string' | 'boolean') => void;
  availableTypes: string[];
  groupByLibrary: boolean;
  onGroupByLibraryChange: (checked: boolean) => void;
}

export type FilterToolbarProps = StylesToolbarProps | TokensToolbarProps;

// ============================================================================
// FilterToolbar Component
// ============================================================================

/**
 * Filter Toolbar Component
 *
 * Sticky toolbar for search and filter controls with prominent search and dropdown filters.
 * Features:
 * - Large, prominent search input
 * - Dropdown menu for Source, Type (tokens only), and Usage filters
 * - Group by library checkbox (right-aligned)
 * - Active filter indicators
 * - Sticky positioning
 */
export default function FilterToolbar(props: FilterToolbarProps) {
  const {
    searchQuery,
    onSearchChange,
    searchPlaceholder = 'Search...',
    sourceFilter,
    onSourceFilterChange,
    usageFilter = 'all',
    onUsageFilterChange,
    groupByLibrary,
    onGroupByLibraryChange,
  } = props;

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Count active filters (excluding 'all' values)
  const activeFilterCount = [
    sourceFilter !== 'all' ? 1 : 0,
    usageFilter !== 'all' ? 1 : 0,
    props.type === 'tokens' && props.typeFilter !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        padding: '12px 0',
      }}
    >
      {/* Search Input - Full Width */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={20}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--figma-color-text-tertiary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '38px',
              paddingRight: '12px',
              paddingTop: '8px',
              paddingBottom: '8px',
              backgroundColor: 'var(--figma-color-bg-secondary)',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '6px',
              color: 'var(--figma-color-text)',
              fontSize: '14px',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--figma-color-bg-brand)';
              e.currentTarget.style.boxShadow = '0 0 0 1px var(--figma-color-bg-brand)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--figma-color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Filter Controls Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Filters Dropdown Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--figma-color-bg)',
              color: 'var(--figma-color-text)',
              cursor: 'pointer',
              outline: 'none',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg)';
            }}
          >
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--figma-color-bg-brand)',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: '600',
                }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={16}
              style={{
                transform: isFilterDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            />
          </button>

          {/* Dropdown Menu */}
          {isFilterDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                minWidth: '200px',
                backgroundColor: 'var(--figma-color-bg)',
                border: '1px solid var(--figma-color-border)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 20,
              }}
            >
              {/* Source Filter */}
              <div style={{ padding: '8px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'var(--figma-color-text-secondary)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    onSourceFilterChange(e.target.value as any);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '13px',
                    border: '1px solid var(--figma-color-border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--figma-color-bg-secondary)',
                    color: 'var(--figma-color-text)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="all">All sources</option>
                  <option value="local">Local only</option>
                  <option value="library">Libraries only</option>
                </select>
              </div>

              {/* Usage Filter */}
              <div
                style={{
                  padding: '8px',
                  borderTop: '1px solid var(--figma-color-border)',
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'var(--figma-color-text-secondary)',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Usage
                </label>
                <select
                  value={usageFilter}
                  onChange={(e) => onUsageFilterChange?.(e.target.value as UsageFilter)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '13px',
                    border: '1px solid var(--figma-color-border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--figma-color-bg-secondary)',
                    color: 'var(--figma-color-text)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="all">All</option>
                  <option value="used">Used only</option>
                  <option value="unused">Unused only</option>
                </select>
              </div>

              {/* Type Filter (Tokens only) */}
              {props.type === 'tokens' && (
                <div
                  style={{
                    padding: '8px',
                    borderTop: '1px solid var(--figma-color-border)',
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: 'var(--figma-color-text-secondary)',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Type
                  </label>
                  <select
                    value={props.typeFilter}
                    onChange={(e) => props.onTypeFilterChange(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '13px',
                      border: '1px solid var(--figma-color-border)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--figma-color-bg-secondary)',
                      color: 'var(--figma-color-text)',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="all">All types</option>
                    {props.availableTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Group by Library Checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--figma-color-text)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            marginLeft: 'auto',
          }}
        >
          <input
            type="checkbox"
            checked={groupByLibrary}
            onChange={(e) => onGroupByLibraryChange(e.target.checked)}
            style={{
              width: '14px',
              height: '14px',
              cursor: 'pointer',
            }}
          />
          <span>Group</span>
        </label>
      </div>

      {/* Close dropdown when clicking outside */}
      {isFilterDropdownOpen && (
        <div
          onClick={() => setIsFilterDropdownOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 19,
          }}
        />
      )}
    </div>
  );
}

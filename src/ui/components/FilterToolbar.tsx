import { Search } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface BaseToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
}

interface StylesToolbarProps extends BaseToolbarProps {
  type: 'styles';
  sourceFilter: 'all' | 'local' | 'library' | 'unused';
  onSourceFilterChange: (filter: 'all' | 'local' | 'library' | 'unused') => void;
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
 * Sticky toolbar for search and filter controls.
 * Spans full width above the 2-column layout (tree view + detail panel).
 *
 * Features:
 * - Search input
 * - Source filter dropdown (All/Local/Library, +Unused for styles)
 * - Type filter dropdown (for tokens only)
 * - Group by library checkbox
 * - Sticky positioning
 */
export default function FilterToolbar(props: FilterToolbarProps) {
  const {
    searchQuery,
    onSearchChange,
    searchPlaceholder = 'Search...',
    sourceFilter,
    onSourceFilterChange,
    groupByLibrary,
    onGroupByLibraryChange,
  } = props;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'var(--figma-color-bg)',
        borderBottom: '1px solid var(--figma-color-border)',
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 auto', minWidth: '200px' }}>
          <Search
            size={18}
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
              paddingTop: '6px',
              paddingBottom: '6px',
              backgroundColor: 'var(--figma-color-bg-secondary)',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '6px',
              color: 'var(--figma-color-text)',
              fontSize: '12px',
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

        {/* Source Filter Dropdown */}
        <select
          value={sourceFilter}
          onChange={(e) => onSourceFilterChange(e.target.value as any)}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            border: '1px solid var(--figma-color-border)',
            borderRadius: '6px',
            backgroundColor: 'var(--figma-color-bg)',
            color: 'var(--figma-color-text)',
            cursor: 'pointer',
            outline: 'none',
            minWidth: '120px',
          }}
        >
          {props.type === 'styles' ? (
            <>
              <option value="all">All styles</option>
              <option value="local">Local styles</option>
              <option value="library">Library styles</option>
              <option value="unused">Unused styles</option>
            </>
          ) : (
            <>
              <option value="all">All tokens</option>
              <option value="local">Local tokens</option>
              <option value="library">Library tokens</option>
            </>
          )}
        </select>

        {/* Type Filter Dropdown (Tokens only) */}
        {props.type === 'tokens' && (
          <select
            value={props.typeFilter}
            onChange={(e) => props.onTypeFilterChange(e.target.value as any)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--figma-color-bg)',
              color: 'var(--figma-color-text)',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '100px',
            }}
          >
            <option value="all">All types</option>
            {props.availableTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        )}

        {/* Group by Library Checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
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
              width: '16px',
              height: '16px',
              cursor: 'pointer',
            }}
          />
          <span>Group by library</span>
        </label>
      </div>
    </div>
  );
}

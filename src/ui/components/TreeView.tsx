import { useState, useMemo, ReactNode, useRef, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface TreeNode<T = any> {
  id: string;
  name: string;
  type: string;
  data?: T;
  children: TreeNode<T>[];
  level: number;
  metadata?: Record<string, any>;
}

export interface TreeViewProps<T = any> {
  /** Tree data structure */
  nodes: TreeNode<T>[];

  /** Optional search functionality */
  searchEnabled?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (query: string) => void;

  /** Render functions for customization */
  renderNode: (node: TreeNode<T>, options: RenderNodeOptions) => ReactNode;
  renderToolbar?: () => ReactNode;
  renderFooter?: () => ReactNode;

  /** Selection state */
  selectedId?: string;
  onNodeSelect?: (node: TreeNode<T>) => void;

  /** Expansion state (controlled or uncontrolled) */
  expandedIds?: Set<string>;
  onExpandedChange?: (expandedIds: Set<string>) => void;
  defaultExpandedIds?: Set<string>;

  /** Styling */
  className?: string;
  containerClassName?: string;
}

export interface RenderNodeOptions {
  isExpanded: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  toggleExpansion: () => void;
  handleSelect: () => void;
  level: number;
}

// ============================================================================
// Tree Helper Functions
// ============================================================================

/**
 * Recursively filter tree nodes based on search query
 */
export function filterTreeNodes<T>(
  nodes: TreeNode<T>[],
  query: string,
  searchFields: (node: TreeNode<T>) => string[]
): TreeNode<T>[] {
  const lowerQuery = query.toLowerCase();

  return nodes
    .map((node) => {
      // Check if this node matches
      const nodeMatches = searchFields(node).some((field) =>
        field.toLowerCase().includes(lowerQuery)
      );

      // Recursively filter children
      const filteredChildren = filterTreeNodes(node.children, query, searchFields);

      // Include node if it matches or has matching children
      if (nodeMatches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }

      return null;
    })
    .filter((node): node is TreeNode<T> => node !== null);
}

/**
 * Flatten tree into array for rendering
 */
export function flattenTree<T>(
  nodes: TreeNode<T>[],
  expandedIds: Set<string>,
  level: number = 0
): TreeNode<T>[] {
  const result: TreeNode<T>[] = [];

  for (const node of nodes) {
    result.push({ ...node, level });

    if (expandedIds.has(node.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expandedIds, level + 1));
    }
  }

  return result;
}

// ============================================================================
// TreeView Component
// ============================================================================

export default function TreeView<T = any>({
  nodes,
  searchEnabled = true,
  searchPlaceholder = 'Search...',
  onSearchChange,
  renderNode,
  renderToolbar,
  renderFooter,
  selectedId,
  onNodeSelect,
  expandedIds: controlledExpandedIds,
  onExpandedChange,
  defaultExpandedIds = new Set(),
  className = '',
  containerClassName = '',
}: TreeViewProps<T>) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Expansion state (uncontrolled if not provided)
  const [uncontrolledExpandedIds, setUncontrolledExpandedIds] = useState<Set<string>>(
    defaultExpandedIds
  );

  const isControlled = controlledExpandedIds !== undefined;
  const expandedIds = isControlled ? controlledExpandedIds : uncontrolledExpandedIds;

  const setExpandedIds = (newExpanded: Set<string>) => {
    if (isControlled) {
      onExpandedChange?.(newExpanded);
    } else {
      setUncontrolledExpandedIds(newExpanded);
    }
  };

  // Flatten tree for rendering
  const flattenedNodes = useMemo(() => {
    return flattenTree(nodes, expandedIds);
  }, [nodes, expandedIds]);

  // Reset focused index when nodes change
  useEffect(() => {
    if (focusedIndex >= flattenedNodes.length && flattenedNodes.length > 0) {
      setFocusedIndex(0);
    }
  }, [flattenedNodes.length, focusedIndex]);

  // Focus the highlighted row
  useEffect(() => {
    const nodeElement = nodeRefs.current.get(focusedIndex);
    if (nodeElement) {
      nodeElement.focus();
    }
  }, [focusedIndex]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearchChange?.(value);
  };

  // Toggle node expansion
  const toggleExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedIds(newExpanded);
  };

  // Handle node selection
  const handleNodeSelect = (node: TreeNode<T>) => {
    onNodeSelect?.(node);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flattenedNodes.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, flattenedNodes.length - 1));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;

      case 'Enter':
        e.preventDefault();
        if (flattenedNodes[focusedIndex]) {
          handleNodeSelect(flattenedNodes[focusedIndex]);
        }
        break;

      case ' ':
        e.preventDefault();
        if (flattenedNodes[focusedIndex]) {
          toggleExpansion(flattenedNodes[focusedIndex].id);
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (flattenedNodes[focusedIndex]) {
          const node = flattenedNodes[focusedIndex];
          if (node.children.length > 0 && !expandedIds.has(node.id)) {
            toggleExpansion(node.id);
          }
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (flattenedNodes[focusedIndex]) {
          const node = flattenedNodes[focusedIndex];
          if (node.children.length > 0 && expandedIds.has(node.id)) {
            toggleExpansion(node.id);
          }
        }
        break;
    }
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden bg-figma-bg border border-figma-border rounded-lg pt-4 ${containerClassName}`}>
      {/* Toolbar (filters, toggles, etc.) */}
      {renderToolbar && (
        <div className="flex-shrink-0 border-b border-figma-border">
          {renderToolbar()}
        </div>
      )}

      {/* Search Input */}
      {searchEnabled && (
        <div className="p-4 flex-shrink-0">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-figma-text-tertiary"
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 bg-figma-bg-secondary border border-figma-border rounded text-figma-text placeholder-figma-text-tertiary focus:outline-none focus:ring-1 focus:ring-figma-bg-brand"
            />
          </div>
        </div>
      )}

      {/* Tree Content */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto ${className}`}
        onKeyDown={handleKeyDown}
        role="tree"
        aria-label="Tree view"
      >
        {flattenedNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-figma-text-secondary">
              {searchQuery ? 'No results found' : 'No items to display'}
            </p>
          </div>
        ) : (
          flattenedNodes.map((node, index) => {
            const isExpanded = expandedIds.has(node.id);
            const isSelected = node.id === selectedId;
            const isFocused = index === focusedIndex;
            const hasChildren = node.children.length > 0;

            return (
              <div
                key={node.id}
                ref={(el) => {
                  if (el) {
                    nodeRefs.current.set(index, el);
                  } else {
                    nodeRefs.current.delete(index);
                  }
                }}
                tabIndex={isFocused ? 0 : -1}
                role="treeitem"
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-selected={isSelected}
                aria-level={node.level + 1}
                onFocus={() => setFocusedIndex(index)}
                onClick={() => {
                  setFocusedIndex(index);
                  handleNodeSelect(node);
                }}
                style={{
                  outline: isFocused ? '2px solid var(--figma-color-border-brand-strong)' : 'none',
                  outlineOffset: '-2px',
                }}
              >
                {renderNode(node, {
                  isExpanded,
                  isSelected,
                  hasChildren,
                  toggleExpansion: () => toggleExpansion(node.id),
                  handleSelect: () => handleNodeSelect(node),
                  level: node.level,
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Footer (stats, shortcuts, etc.) */}
      {/*{renderFooter && (
        <div className="flex-shrink-0 border-t border-figma-border">
          {renderFooter()}
        </div>
      )}*/}
    </div>
  );
}

// ============================================================================
// Common Node Renderers (Helpers)
// ============================================================================

interface DefaultNodeRowProps {
  /** Main content */
  children: ReactNode;
  /** Left side content (expand icon, indent) */
  leftContent?: ReactNode;
  /** Right side content (badges, counts) */
  rightContent?: ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Styling */
  isSelected?: boolean;
  isDisabled?: boolean;
  className?: string;
}

/**
 * Default styled row component for tree nodes
 */
export function DefaultNodeRow({
  children,
  leftContent,
  rightContent,
  onClick,
  isSelected = false,
  isDisabled = false,
  className = '',
}: DefaultNodeRowProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        backgroundColor: isSelected ? 'var(--figma-color-bg-brand)' : 'transparent',
        color: isSelected ? 'var(--figma-color-text-onbrand)' : 'var(--figma-color-text)',
        borderRadius: '0',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !isDisabled) {
          e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isDisabled) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
      className={className}
    >
      {leftContent && <div className="flex-shrink-0">{leftContent}</div>}
      <div className="flex-1 min-w-0">{children}</div>
      {rightContent && <div className="flex-shrink-0 ml-3">{rightContent}</div>}
    </div>
  );
}

/**
 * Expand/collapse icon component
 */
export function ExpandIcon({ isExpanded }: { isExpanded: boolean }) {
  return isExpanded ? (
    <ChevronDown size={16} className="text-figma-text-secondary" />
  ) : (
    <ChevronRight size={16} className="text-figma-text-secondary" />
  );
}

/**
 * Usage count badge component
 */
export function UsageBadge({ count, variant = 'default' }: { count: number; variant?: 'default' | 'brand' }) {
  if (count === 0) return null;

  return (
    <span
      className={`
        text-xs px-2 py-1 rounded-full font-medium
        ${variant === 'brand' ? 'bg-figma-bg-brand text-figma-color-text-onbrand' : 'bg-figma-bg-secondary text-figma-text'}
      `}
    >
      {count}
    </span>
  );
}

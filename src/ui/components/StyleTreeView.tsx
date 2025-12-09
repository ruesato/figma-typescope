import { useState, useMemo, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TextStyle, TextLayer, LibrarySource } from '@/shared/types';
import { shouldVirtualize, ITEM_SIZES, OVERSCAN_COUNTS } from '@/ui/utils/virtualization';

/**
 * Style Tree View Component (Virtualized - T123)
 *
 * Displays text styles grouped by library source with expandable hierarchy.
 * Uses TanStack Virtual for 1000+ styles with <500ms render time.
 *
 * Features:
 * - Virtualized rendering for enterprise-scale (1000+ styles)
 * - Library grouping (Local + Team Libraries)
 * - Hierarchy navigation (Typography/Heading/H1)
 * - Usage count badges
 * - Expand/collapse functionality
 * - Search and filter support
 * - "Needs Styling" section for unstyled text
 * - GPU acceleration and smooth scrolling
 */

interface StyleTreeViewProps {
  styles: TextStyle[];
  libraries: LibrarySource[];
  unstyledLayers: TextLayer[];
  onStyleSelect?: (style: TextStyle) => void;
  onUnstyledSelect?: (layers: TextLayer[]) => void;
  selectedStyleId?: string;
  disabledStyleId?: string; // Style that cannot be selected (shown with "Current" badge)
  replacedStyleIds?: Set<string>; // Styles that have been replaced (shown with green circle)
  replacementHistory?: Map<
    string,
    { targetStyleId: string; targetStyleName: string; count: number }
  >; // Track original styles that were replaced
  className?: string;
  // Filter props (controlled from parent)
  searchQuery?: string;
  sourceFilter?: 'all' | 'local' | 'library' | 'unused';
  groupByLibrary?: boolean;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'library' | 'style' | 'unstyled';
  style?: TextStyle;
  children: TreeNode[];
  usageCount: number;
  expanded?: boolean;
  level: number;
}

export default function StyleTreeView({
  styles,
  libraries,
  unstyledLayers,
  onStyleSelect,
  onUnstyledSelect,
  selectedStyleId,
  disabledStyleId,
  replacedStyleIds,
  replacementHistory,
  className = '',
  searchQuery = '',
  sourceFilter = 'all',
  groupByLibrary: groupByLibraryProp,
}: StyleTreeViewProps) {
  // Use internal state for groupByLibrary with Figma client storage sync
  const [groupByLibrary, setGroupByLibrary] = useState(() => {
    // Use prop value if provided, otherwise default to true
    if (groupByLibraryProp !== undefined) return groupByLibraryProp;
    // Load from Figma client storage if available
    if (typeof window !== 'undefined' && (window as any).parent) {
      // Will be loaded via useEffect
      return true;
    }
    return true;
  });

  // Track manually toggled nodes
  const [manuallyExpandedNodes, setManuallyExpandedNodes] = useState<Set<string>>(new Set());

  // Load groupByLibrary preference from Figma client storage
  useEffect(() => {
    const loadPreference = async () => {
      try {
        parent.postMessage({ pluginMessage: { type: 'GET_GROUP_BY_LIBRARY' } }, '*');
      } catch (error) {
        console.warn('Failed to load groupByLibrary preference:', error);
      }
    };
    loadPreference();
  }, []);

  // Listen for groupByLibrary preference response
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.pluginMessage?.type === 'GROUP_BY_LIBRARY_LOADED') {
        setGroupByLibrary(event.data.pluginMessage.payload?.enabled ?? true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Save groupByLibrary preference when it changes
  useEffect(() => {
    try {
      parent.postMessage(
        { pluginMessage: { type: 'SAVE_GROUP_BY_LIBRARY', payload: { enabled: groupByLibrary } } },
        '*'
      );
    } catch (error) {
      console.warn('Failed to save groupByLibrary preference:', error);
    }
  }, [groupByLibrary]);

  // Build tree structure from styles and libraries
  const treeData = useMemo(() => {
    const tree: TreeNode[] = [];

    // Group by library if enabled
    if (groupByLibrary) {
      for (const library of libraries) {
        const libraryStyles = styles.filter((s) => s.libraryName === library.name);

        if (libraryStyles.length > 0) {
          const libraryNode: TreeNode = {
            id: `library-${library.id}`,
            name: library.name,
            type: 'library',
            children: buildStyleNodes(libraryStyles, new Set()),
            usageCount: libraryStyles.reduce((sum, style) => sum + style.usageCount, 0),
            level: 0,
          };
          tree.push(libraryNode);
        }
      }
    } else {
      // Flat list of styles
      const flatStyles = buildStyleNodes(styles, new Set());
      tree.push(...flatStyles);
    }

    // Add "Needs Styling" section if unstyled layers exist
    if (unstyledLayers.length > 0) {
      const unstyledNode: TreeNode = {
        id: 'unstyled',
        name: 'Needs Styling',
        type: 'unstyled',
        children: [], // No children - will show layers directly
        usageCount: unstyledLayers.length,
        level: groupByLibrary ? 0 : styles.length,
      };
      tree.push(unstyledNode);
    }

    return tree;
  }, [styles, libraries, unstyledLayers, groupByLibrary]);

  // Filter tree based on search query and source filter
  const filteredTree = useMemo(() => {
    let result = treeData;

    // Apply source filter
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'local') {
        // Show only local styles (libraryName === 'Local' or no libraryName)
        result = result.filter((node) => {
          if (node.type === 'library') {
            return node.name === 'Local' || node.name.includes('Local');
          }
          return true;
        });
      } else if (sourceFilter === 'library') {
        // Show only library styles (libraryName !== 'Local')
        result = result.filter((node) => {
          if (node.type === 'library') {
            return node.name !== 'Local' && !node.name.includes('Local');
          }
          return true;
        });
      } else if (sourceFilter === 'unused') {
        // Show only unused styles
        result = result
          .map((node) => ({
            ...node,
            children: node.children.filter((child) => child.usageCount === 0),
          }))
          .filter((node) => node.children.length > 0 || node.usageCount === 0);
      }
    }

    // Apply search filter
    if (!searchQuery.trim()) {
      return result;
    }

    return filterTree(result, searchQuery.toLowerCase());
  }, [treeData, searchQuery, sourceFilter]);

  // Calculate expanded nodes - auto-expand all library nodes when tree changes
  const expandedNodes = useMemo(() => {
    const expanded = new Set<string>(manuallyExpandedNodes);
    // Auto-expand all library nodes
    filteredTree.forEach((node) => {
      if (node.type === 'library') {
        expanded.add(node.id);
      }
    });
    return expanded;
  }, [filteredTree, manuallyExpandedNodes]);

  // Toggle node expansion
  const toggleExpansion = (nodeId: string) => {
    const newManuallyExpanded = new Set(manuallyExpandedNodes);
    if (expandedNodes.has(nodeId)) {
      // Collapsing - add to manually expanded to override auto-expand
      newManuallyExpanded.delete(nodeId);
    } else {
      // Expanding - add to manually expanded
      newManuallyExpanded.add(nodeId);
    }
    setManuallyExpandedNodes(newManuallyExpanded);
  };

  // Handle node selection
  const handleNodeClick = (node: TreeNode) => {
    if (node.type === 'style' && node.style && onStyleSelect) {
      onStyleSelect(node.style);
    } else if (node.type === 'unstyled' && onUnstyledSelect) {
      onUnstyledSelect(unstyledLayers);
    }
  };

  // Keyboard navigation
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Get all selectable style nodes in display order
  const getSelectableStyles = (): TextStyle[] => {
    const selectableStyles: TextStyle[] = [];
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'style' && node.style) {
          selectableStyles.push(node.style);
        }
        if (node.type === 'library' && expandedNodes.has(node.id)) {
          traverse(node.children);
        }
      }
    };
    traverse(filteredTree);
    return selectableStyles;
  };

  // Handle keyboard navigation (arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      const selectableStyles = getSelectableStyles();
      if (selectableStyles.length === 0) return;

      const currentIndex = selectableStyles.findIndex((s) => s.id === selectedStyleId);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex < selectableStyles.length - 1) {
          const nextStyle = selectableStyles[currentIndex + 1];
          if (onStyleSelect) onStyleSelect(nextStyle);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
          const prevStyle = selectableStyles[currentIndex - 1];
          if (onStyleSelect) onStyleSelect(prevStyle);
        } else if (currentIndex === -1 && selectableStyles.length > 0) {
          // No selection, select first
          if (onStyleSelect) onStyleSelect(selectableStyles[0]);
        }
      }
    };

    const container = treeContainerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedStyleId, filteredTree, expandedNodes, onStyleSelect]);

  // Flatten tree for virtualization (includes only visible/expanded nodes)
  const flattenedTree = useMemo(() => {
    const flattened: (TreeNode & { displayLevel: number })[] = [];

    const traverse = (nodes: TreeNode[], level: number) => {
      for (const node of nodes) {
        flattened.push({ ...node, displayLevel: level });
        if (expandedNodes.has(node.id) && node.children.length > 0) {
          traverse(node.children, level + 1);
        }
      }
    };

    traverse(filteredTree, 0);
    return flattened;
  }, [filteredTree, expandedNodes]);

  // Determine if virtualization is needed
  const shouldUseVirt = shouldVirtualize(flattenedTree.length, 'tree');

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: flattenedTree.length,
    getScrollElement: () => treeContainerRef.current,
    estimateSize: () => ITEM_SIZES.treeNode,
    overscan: OVERSCAN_COUNTS.tree,
    gap: 0,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Render single tree node
  const renderTreeNode = (node: TreeNode & { displayLevel: number }): JSX.Element => {
    const level = node.displayLevel;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = node.type === 'style' && node.style?.id === selectedStyleId;
    const isDisabled = node.type === 'style' && node.style?.id === disabledStyleId;
    const isReplacedStyle =
      node.type === 'style' && node.style?.id && replacementHistory?.has(node.style.id);
    const receivedReplacements =
      node.type === 'style' && node.style?.id && replacedStyleIds?.has(node.style.id);
    const hasChildren = node.children.length > 0;
    const isExpandable = hasChildren || node.type === 'library';
    const replacementCount = Array.from(replacementHistory?.values() || [])
      .filter((entry) => entry.targetStyleId === node.style?.id)
      .reduce((sum, entry) => sum + entry.count, 0);

    return (
      <div
        onClick={() => {
          if (isDisabled || isReplacedStyle) return;
          if (isExpandable) {
            toggleExpansion(node.id);
          } else {
            handleNodeClick(node);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          paddingLeft: `${level * 20 + 8}px`,
          cursor: isDisabled || isReplacedStyle ? 'not-allowed' : 'pointer',
          backgroundColor: isSelected ? 'var(--figma-color-bg-brand)' : 'transparent',
          color: isSelected
            ? 'var(--figma-color-text-onbrand)'
            : isReplacedStyle
              ? 'var(--figma-color-text-tertiary)'
              : 'var(--figma-color-text)',
          borderRadius: '4px',
          fontSize: '12px',
          transition: 'background-color 0.15s ease',
          opacity: isDisabled || isReplacedStyle ? 0.6 : 1,
          height: `${ITEM_SIZES.treeNode}px`,
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
      >
        {/* Expand/Collapse Icon */}
        {isExpandable && (
          <span style={{ fontSize: '10px', color: 'var(--figma-color-icon-secondary)' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}

        {/* Replacement Indicator */}
        {node.type === 'style' && (
          <>
            {isReplacedStyle && (
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--figma-color-bg-tertiary)',
                  flexShrink: 0,
                }}
                title="This style was replaced"
              />
            )}
            {receivedReplacements && (
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  flexShrink: 0,
                }}
                title="This style received replacements from other styles"
              />
            )}
          </>
        )}

        {/* Node Name with count */}
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: isReplacedStyle ? 'var(--figma-color-text-tertiary)' : 'inherit',
          }}
        >
          {node.name} {node.type === 'library' && `(${node.usageCount})`}
          {node.type === 'style' &&
            (isReplacedStyle ? (
              ` (0)`
            ) : (
              <>
                {node.usageCount > 0 && ` (${node.usageCount})`}
                {receivedReplacements && replacementCount > 0 && ` (+${replacementCount})`}
              </>
            ))}
        </span>

        {/* Current badge */}
        {isDisabled && (
          <span
            style={{
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--figma-color-bg-disabled)',
              color: 'var(--figma-color-text-disabled)',
              fontSize: '10px',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Current
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`style-tree-view ${className}`}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Non-virtualized for small datasets */}
      {!shouldUseVirt ? (
        <div
          ref={treeContainerRef}
          tabIndex={0}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'var(--figma-space-sm)',
            outline: 'none',
          }}
        >
          {flattenedTree.length === 0 ? (
            <div
              style={{
                padding: 'var(--figma-space-md)',
                textAlign: 'center',
                color: 'var(--figma-color-text-secondary)',
                fontSize: '12px',
              }}
            >
              {searchQuery ? 'No styles found matching your search.' : 'No styles found.'}
            </div>
          ) : (
            flattenedTree.map((node) => (
              <div key={node.id}>{renderTreeNode(node)}</div>
            ))
          )}
        </div>
      ) : (
        /* Virtualized rendering for large datasets */
        <div
          ref={treeContainerRef}
          tabIndex={0}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'var(--figma-space-sm)',
            outline: 'none',
            contain: 'layout style paint',
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        >
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualItems.length === 0 ? (
              <div
                style={{
                  padding: 'var(--figma-space-md)',
                  textAlign: 'center',
                  color: 'var(--figma-color-text-secondary)',
                  fontSize: '12px',
                }}
              >
                {searchQuery ? 'No styles found matching your search.' : 'No styles found.'}
              </div>
            ) : (
              virtualItems.map((virtualItem) => {
                const node = flattenedTree[virtualItem.index];
                return (
                  <div
                    key={node.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {renderTreeNode(node)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Build style nodes from style array
 *
 * @param styles - Array of text styles
 * @param expandedNodes - Set of expanded node IDs
 * @returns Array of tree nodes
 */
function buildStyleNodes(styles: TextStyle[], expandedNodes: Set<string>): TreeNode[] {
  return styles.map((style) => {
    const isExpanded = expandedNodes.has(style.id);

    return {
      id: style.id,
      name: style.name,
      type: 'style',
      style,
      children: [], // Styles don't have children in this simple implementation
      usageCount: style.usageCount,
      expanded: isExpanded,
      level: 0,
    };
  });
}

/**
 * Filter tree nodes based on search query
 *
 * @param nodes - Array of tree nodes
 * @param query - Lowercase search query
 * @returns Filtered tree nodes
 */
function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  return nodes.reduce((filtered: TreeNode[], node) => {
    const matches = nodeMatchesQuery(node, query);

    if (matches) {
      // Include node and all its children
      const filteredNode = { ...node };
      if (node.children.length > 0) {
        filteredNode.children = filterTree(node.children, query);
      }
      filtered.push(filteredNode);
    } else if (node.children.length > 0) {
      // Check if any children match
      const matchingChildren = filterTree(node.children, query);
      if (matchingChildren.length > 0) {
        filtered.push({
          ...node,
          children: matchingChildren,
        });
      }
    }

    return filtered;
  }, []);
}

/**
 * Check if a tree node matches the search query
 *
 * @param node - Tree node to check
 * @param query - Lowercase search query
 * @returns True if node matches query
 */
function nodeMatchesQuery(node: TreeNode, query: string): boolean {
  if (query.length === 0) {
    return true;
  }

  const searchText = node.name.toLowerCase();
  return searchText.includes(query);
}

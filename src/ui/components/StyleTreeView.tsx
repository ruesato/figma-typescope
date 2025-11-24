import { useState, useMemo, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { TextStyle, TextLayer, LibrarySource } from '@/shared/types';

/**
 * Style Tree View Component
 *
 * Displays text styles grouped by library source with expandable hierarchy.
 * Shows usage counts, supports search/filter, and provides drill-down.
 *
 * Features:
 * - Library grouping (Local + Team Libraries)
 * - Hierarchy navigation (Typography/Heading/H1)
 * - Usage count badges
 * - Expand/collapse functionality
 * - Search and filter support
 * - "Needs Styling" section for unstyled text
 */

interface StyleTreeViewProps {
  styles: TextStyle[];
  libraries: LibrarySource[];
  unstyledLayers: TextLayer[];
  onStyleSelect?: (style: TextStyle) => void;
  onUnstyledSelect?: (layers: TextLayer[]) => void;
  selectedStyleId?: string;
  className?: string;
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
  className = '',
}: StyleTreeViewProps) {
  // Initialize expanded nodes with all library nodes expanded by default
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    libraries.forEach((lib) => {
      initialExpanded.add(`library-${lib.id}`);
    });
    return initialExpanded;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [groupByLibrary, setGroupByLibrary] = useState(() => {
    // Load from Figma client storage if available
    if (typeof window !== 'undefined' && (window as any).parent) {
      // Will be loaded via useEffect
      return true;
    }
    return true;
  });
  const [usageFilter, setUsageFilter] = useState<'all' | 'local' | 'library' | 'unused'>('all');

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
        setGroupByLibrary(event.data.pluginMessage.value ?? true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Save groupByLibrary preference when it changes
  useEffect(() => {
    try {
      parent.postMessage(
        { pluginMessage: { type: 'SAVE_GROUP_BY_LIBRARY', value: groupByLibrary } },
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
            children: buildStyleNodes(libraryStyles, expandedNodes),
            usageCount: libraryStyles.reduce((sum, style) => sum + style.usageCount, 0),
            level: 0,
          };
          tree.push(libraryNode);
        }
      }
    } else {
      // Flat list of styles
      const flatStyles = buildStyleNodes(styles, expandedNodes);
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
  }, [styles, libraries, unstyledLayers, expandedNodes, groupByLibrary]);

  // Filter tree based on search query and usage filter
  const filteredTree = useMemo(() => {
    let result = treeData;

    // Apply usage filter
    if (usageFilter !== 'all') {
      if (usageFilter === 'local') {
        // Show only local styles (libraryName === 'Local' or no libraryName)
        result = result.filter((node) => {
          if (node.type === 'library') {
            return node.name === 'Local' || node.name.includes('Local');
          }
          return true;
        });
      } else if (usageFilter === 'library') {
        // Show only library styles (libraryName !== 'Local')
        result = result.filter((node) => {
          if (node.type === 'library') {
            return node.name !== 'Local' && !node.name.includes('Local');
          }
          return true;
        });
      } else if (usageFilter === 'unused') {
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
  }, [treeData, searchQuery, usageFilter]);

  // Toggle node expansion
  const toggleExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
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

  // Render tree node
  const renderNode = (node: TreeNode, level: number = 0): JSX.Element => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = node.type === 'style' && node.style?.id === selectedStyleId;
    const hasChildren = node.children.length > 0;
    const isExpandable = hasChildren || node.type === 'library';

    return (
      <div key={node.id}>
        <div
          onClick={() => {
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
            cursor: 'pointer',
            backgroundColor: isSelected ? 'var(--figma-color-bg-brand)' : 'transparent',
            color: isSelected ? 'var(--figma-color-text-onbrand)' : 'var(--figma-color-text)',
            borderRadius: '4px',
            fontSize: '12px',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
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

          {/* Node Name with count */}
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {node.name} {node.type === 'library' && `(${node.usageCount})`}
            {node.type === 'style' && node.usageCount > 0 && ` (${node.usageCount})`}
          </span>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>{node.children.map((child) => renderNode(child, level + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`style-tree-view ${className}`}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Controls - Horizontal layout matching mockup */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--figma-space-sm)',
          padding: 'var(--figma-space-md)',
          borderBottom: '1px solid var(--figma-color-border)',
        }}
      >
        {/* Search bar - Left */}
        <div style={{ position: 'relative', flex: 1, maxWidth: '200px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--figma-color-icon-secondary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '32px',
              paddingLeft: '28px',
              paddingRight: '8px',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--figma-color-bg)',
              color: 'var(--figma-color-text)',
              fontSize: '12px',
            }}
          />
        </div>

        {/* Dropdown filter - Middle */}
        <select
          value={usageFilter}
          onChange={(e) => setUsageFilter(e.target.value as 'all' | 'local' | 'library' | 'unused')}
          style={{
            height: '32px',
            padding: '0 24px 0 8px',
            border: '1px solid var(--figma-color-border)',
            borderRadius: '4px',
            backgroundColor: 'var(--figma-color-bg)',
            color: 'var(--figma-color-text)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <option value="all">All styles</option>
          <option value="local">Local only</option>
          <option value="library">Library only</option>
          <option value="unused">Unused styles</option>
        </select>

        {/* Toggle - Right */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            color: 'var(--figma-color-text)',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={groupByLibrary}
            onChange={(e) => setGroupByLibrary(e.target.checked)}
            style={{
              width: '32px',
              height: '16px',
              cursor: 'pointer',
            }}
          />
          <span>Group by library</span>
        </label>
      </div>

      {/* Tree - Scrollable */}
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
        {filteredTree.length === 0 ? (
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
          filteredTree.map((node) => renderNode(node))
        )}
      </div>
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

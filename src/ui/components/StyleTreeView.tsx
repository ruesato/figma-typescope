import React, { useState, useMemo } from 'react';
import type { TextStyle, TextLayer, StyleHierarchyNode, LibrarySource } from '@/shared/types';

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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByLibrary, setGroupByLibrary] = useState(true);

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

  // Filter tree based on search query
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) {
      return treeData;
    }

    return filterTree(treeData, searchQuery.toLowerCase());
  }, [treeData, searchQuery]);

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

  // Render tree node
  const renderNode = (node: TreeNode, level: number = 0): JSX.Element => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = node.type === 'style' && node.style?.id === selectedStyleId;
    const hasChildren = node.children.length > 0;
    const isExpandable = hasChildren || node.type === 'library';

    return (
      <div key={node.id} className={`tree-node level-${level} ${isSelected ? 'selected' : ''}`}>
        <div
          className="tree-node-content"
          onClick={() => handleNodeClick(node)}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
          {/* Expand/Collapse Icon */}
          {isExpandable && <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>}

          {/* Node Icon */}
          <span className="node-icon">
            {node.type === 'library' && '📚'}
            {node.type === 'style' && '📝'}
            {node.type === 'unstyled' && '⚠️'}
          </span>

          {/* Node Name */}
          <span className="node-name">{node.name}</span>

          {/* Usage Count Badge */}
          {node.usageCount > 0 && (
            <span className="usage-badge">{node.usageCount.toLocaleString()}</span>
          )}
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="tree-children">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`style-tree-view ${className}`}>
      {/* Controls */}
      <div className="tree-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search styles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="view-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={groupByLibrary}
              onChange={(e) => setGroupByLibrary(e.target.checked)}
            />
            Group by Library
          </label>
        </div>
      </div>

      {/* Tree */}
      <div className="tree-container">
        {filteredTree.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? 'No styles found matching your search.' : 'No styles found.'}
          </div>
        ) : (
          filteredTree.map((node) => renderNode(node))
        )}
      </div>

      {/* Summary */}
      <div className="tree-summary">
        <div className="summary-item">
          <span className="summary-label">Total Styles:</span>
          <span className="summary-value">{styles.length.toLocaleString()}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Libraries:</span>
          <span className="summary-value">{libraries.length.toLocaleString()}</span>
        </div>
        {unstyledLayers.length > 0 && (
          <div className="summary-item warning">
            <span className="summary-label">Needs Styling:</span>
            <span className="summary-value">{unstyledLayers.length.toLocaleString()}</span>
          </div>
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

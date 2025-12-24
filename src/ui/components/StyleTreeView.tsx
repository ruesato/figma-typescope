import { useState, useMemo, useEffect } from 'react';
import TreeView, { TreeNode, DefaultNodeRow, ExpandIcon, UsageBadge } from './TreeView';
import { useFuzzySearch } from '@/ui/hooks/useFuzzySearch';
import type { TextStyle, TextLayer, LibrarySource } from '@/shared/types';

/**
 * Style Tree View Component
 *
 * Displays text styles grouped by library source with expandable hierarchy.
 * Uses reusable TreeView component for consistent UI with TokenView.
 *
 * Features:
 * - Library grouping (Local + Team Libraries)
 * - Hierarchy navigation with expand/collapse
 * - Usage count badges
 * - Search and filter support
 * - "Needs Styling" section for unstyled text
 * - Replacement status indicators (badges and secondary text)
 * - Multi-line rows with clear visual hierarchy
 * - Footer with stats and keyboard shortcuts
 * - Builtin virtualization for large datasets (1000+ styles)
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
  highlightedStyleIds?: Set<string>; // Styles to highlight (newly created local styles)
  className?: string;
  // Filter props (controlled from parent)
  searchQuery?: string;
  sourceFilter?: 'all' | 'local' | 'library';
  usageFilter?: 'all' | 'used' | 'unused';
  groupByLibrary?: boolean;
}

// TreeNode interface from TreeView is used, with TextStyle as data property
// metadata stores: usageCount, isReplaced, receivedReplacements count

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
  highlightedStyleIds,
  className = '',
  searchQuery = '',
  sourceFilter = 'all',
  usageFilter = 'all',
  groupByLibrary: groupByLibraryProp,
}: StyleTreeViewProps) {
  // Use internal state for groupByLibrary with Figma client storage sync
  const [groupByLibrary, setGroupByLibrary] = useState(() => {
    if (groupByLibraryProp !== undefined) return groupByLibraryProp;
    return true;
  });

  // Expansion state
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Sync prop changes to internal state
  useEffect(() => {
    if (groupByLibraryProp !== undefined) {
      setGroupByLibrary(groupByLibraryProp);
    }
  }, [groupByLibraryProp]);

  // Load groupByLibrary preference from Figma client storage
  useEffect(() => {
    try {
      parent.postMessage({ pluginMessage: { type: 'GET_GROUP_BY_LIBRARY' } }, '*');
    } catch (error) {
      console.warn('Failed to load groupByLibrary preference:', error);
    }
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
    const tree: TreeNode<TextStyle>[] = [];

    // Group by library if enabled
    if (groupByLibrary) {
      for (const library of libraries) {
        const libraryStyles = styles.filter((s) => s.libraryName === library.name);

        if (libraryStyles.length > 0) {
          const usageCount = libraryStyles.reduce((sum, style) => sum + style.usageCount, 0);
          const libraryNode: TreeNode<TextStyle> = {
            id: `library-${library.id}`,
            name: library.name,
            type: 'library',
            children: libraryStyles.map((style) => ({
              id: style.id,
              name: style.name,
              type: 'style',
              data: style,
              children: [],
              level: 1,
              metadata: {
                usageCount: style.usageCount,
                isReplaced: replacementHistory?.has(style.id),
                receivedReplacements: replacedStyleIds?.has(style.id),
              },
            })),
            level: 0,
            metadata: {
              usageCount,
            },
          };
          tree.push(libraryNode);
        }
      }
    } else {
      // Flat list of styles
      tree.push(
        ...styles.map((style) => ({
          id: style.id,
          name: style.name,
          type: 'style',
          data: style,
          children: [],
          level: 0,
          metadata: {
            usageCount: style.usageCount,
            isReplaced: replacementHistory?.has(style.id),
            receivedReplacements: replacedStyleIds?.has(style.id),
          },
        }))
      );
    }

    // Add "Needs Styling" section if unstyled layers exist
    if (unstyledLayers.length > 0) {
      const unstyledNode: TreeNode<TextStyle> = {
        id: 'unstyled',
        name: 'Needs Styling',
        type: 'unstyled',
        children: [],
        level: 0,
        metadata: {
          usageCount: unstyledLayers.length,
        },
      };
      tree.push(unstyledNode);
    }

    return tree;
  }, [styles, libraries, unstyledLayers, groupByLibrary, replacementHistory, replacedStyleIds]);

  // Update expansion state when tree structure changes to expand top-level nodes
  useEffect(() => {
    const expanded = new Set<string>();
    treeData.forEach((node) => {
      if (node.type === 'library' || node.type === 'unstyled') {
        expanded.add(node.id);
      }
    });
    setExpandedNodeIds(expanded);
  }, [treeData]);

  // Apply search filtering using fuzzy search
  const searchFilteredStyles = useFuzzySearch(
    styles,
    searchQuery,
    ['name']
  );

  const searchFilteredStyleIds = useMemo(() => {
    return new Set(searchFilteredStyles.map(s => s.id));
  }, [searchFilteredStyles]);

  // Filter tree based on search query, source filter, and usage filter
  const filteredTree = useMemo(() => {
    let result = treeData;

    // Apply source filter
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'local') {
        result = result.filter((node) => {
          if (node.type === 'library') {
            return node.name === 'Local' || node.name.includes('Local');
          }
          return true;
        });
      } else if (sourceFilter === 'library') {
        result = result.filter((node) => {
          if (node.type === 'library') {
            return node.name !== 'Local' && !node.name.includes('Local');
          }
          return true;
        });
      }
    }

    // Apply usage filter
    if (usageFilter !== 'all') {
      result = result
        .map((node) => ({
          ...node,
          children: node.children.filter((child) => {
            const usageCount = child.metadata?.usageCount ?? 0;
            if (usageFilter === 'used') return usageCount > 0;
            if (usageFilter === 'unused') return usageCount === 0;
            return true;
          }),
        }))
        .filter((node) => {
          // Keep library nodes if they have matching children, or if it's an unstyled node
          if (node.type === 'library') {
            return node.children.length > 0;
          }
          return true;
        });
    }

    // Apply search filter with fuzzy matching
    if (!searchQuery.trim()) {
      return result;
    }

    return filterTree(result, searchFilteredStyleIds);
  }, [treeData, searchQuery, searchFilteredStyleIds, sourceFilter, usageFilter]);


  // Handle node selection
  const handleNodeSelect = (node: TreeNode<TextStyle>) => {
    if (node.type === 'style' && node.data && onStyleSelect) {
      onStyleSelect(node.data);
    } else if (node.type === 'unstyled' && onUnstyledSelect) {
      onUnstyledSelect(unstyledLayers);
    }
  };

  // Render node with proper styling and badges
  const renderStyleNode = (node: TreeNode<TextStyle>, options: any) => {
    const isReplacedStyle = node.type === 'style' && node.metadata?.isReplaced;
    const receivedReplacements = node.type === 'style' && node.metadata?.receivedReplacements;
    const usageCount = node.metadata?.usageCount ?? 0;
    const isDisabled = node.type === 'style' && node.data?.id === disabledStyleId;
    const isHighlighted = node.type === 'style' && highlightedStyleIds?.has(node.data?.id || '');

    // Calculate replacement count for this style as target
    const replacementCount = Array.from(replacementHistory?.values() || [])
      .filter((entry) => entry.targetStyleId === node.data?.id)
      .reduce((sum, entry) => sum + entry.count, 0);

    // Library nodes
    if (node.type === 'library') {
      return (
        <DefaultNodeRow
          onClick={options.toggleExpansion}
          leftContent={<ExpandIcon isExpanded={options.isExpanded} />}
          rightContent={<UsageBadge count={usageCount} />}
        >
          <span className="text-sm font-semibold">{node.name}</span>
        </DefaultNodeRow>
      );
    }

    // Style nodes
    if (node.type === 'style') {
      return (
        <DefaultNodeRow
          onClick={options.handleSelect}
          isSelected={options.isSelected}
          isDisabled={isDisabled || isReplacedStyle}
          style={{
            animation: isHighlighted ? 'highlight-flash 2s ease-in-out' : undefined,
          }}
          leftContent={
            <div className="flex items-center gap-2" style={{ marginLeft: `${options.level * 20}px` }}>
              {isReplacedStyle && (
                <span className="text-xs px-2 py-0.5 rounded bg-figma-bg-tertiary text-figma-text-tertiary">
                  Replaced
                </span>
              )}
            </div>
          }
          rightContent={
            <div className="flex items-center gap-2">
              {isDisabled && (
                <span className="text-xs px-2 py-0.5 rounded bg-figma-bg-disabled text-figma-text-disabled font-medium">
                  Current
                </span>
              )}
              <UsageBadge count={isReplacedStyle ? 0 : usageCount} />
            </div>
          }
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{node.name}</div>
            {receivedReplacements && replacementCount > 0 && (
              <div className="text-xs text-figma-text-tertiary mt-1">
                +{replacementCount} received from other styles
              </div>
            )}
          </div>
        </DefaultNodeRow>
      );
    }

    // Unstyled node
    if (node.type === 'unstyled') {
      return (
        <DefaultNodeRow onClick={options.handleSelect}>
          <span className="text-sm font-medium">Needs Styling</span>
          <UsageBadge count={usageCount} variant="brand" />
        </DefaultNodeRow>
      );
    }

    return null;
  };

  // Render footer with stats and keyboard shortcuts
  const renderFooter = () => {
    const flattenedList: TreeNode<TextStyle>[] = [];
    const flatten = (nodes: TreeNode<TextStyle>[]) => {
      for (const node of nodes) {
        flattenedList.push(node);
        if (expandedNodeIds.has(node.id)) {
          flatten(node.children);
        }
      }
    };
    flatten(filteredTree);
    const visibleCount = flattenedList.filter((n) => n.type === 'style').length;
    const totalCount = treeData.filter((n) => n.type === 'style').length;
    const isFiltered = searchQuery.trim() !== '' || sourceFilter !== 'all' || usageFilter !== 'all';

    return (
      <div className="p-3 text-xs bg-figma-bg-secondary text-figma-text-tertiary border-t border-figma-border">
        <div className="flex flex-col gap-2">
          <div className="text-center">
            Showing {visibleCount} style{visibleCount !== 1 ? 's' : ''}
            {isFiltered && ` (filtered from ${totalCount})`}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <span>
              <kbd className="px-1">↑/↓</kbd> navigate
            </span>
            <span>•</span>
            <span>
              <kbd className="px-1">Enter</kbd> select
            </span>
            <span>•</span>
            <span>
              <kbd className="px-1">Space</kbd> expand/collapse
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Handle expansion state changes
  const handleExpandedChange = (newExpanded: Set<string>) => {
    setExpandedNodeIds(newExpanded);
  };

  // Custom empty state
  const renderTreeContent = () => {
    if (filteredTree.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-figma-bg">
          <div className="text-5xl mb-4">{searchQuery ? '🔍' : '📝'}</div>
          <h3 className="text-lg font-semibold text-figma-text">
            {searchQuery ? 'No Matches Found' : 'No Text Styles'}
          </h3>
          <p className="mt-2 text-center text-figma-text-secondary">
            {searchQuery ? 'Try adjusting your search or filters' : 'Text styles from your design will appear here'}
          </p>
        </div>
      );
    }

    return (
      <TreeView
        nodes={filteredTree}
        searchEnabled={false}
        selectedId={selectedStyleId}
        onNodeSelect={handleNodeSelect}
        expandedIds={expandedNodeIds}
        onExpandedChange={handleExpandedChange}
        renderNode={renderStyleNode}
        renderFooter={renderFooter}
        className={className}
      />
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes highlight-flash {
          0%, 100% { background-color: transparent; }
          50% { background-color: var(--figma-color-bg-success-tertiary); }
        }
      `}</style>
      {renderTreeContent()}
    </div>
  );
}

/**
 * Filter tree nodes based on search matched style IDs
 */
function filterTree(nodes: TreeNode<TextStyle>[], matchedStyleIds: Set<string>): TreeNode<TextStyle>[] {
  return nodes.reduce((filtered: TreeNode<TextStyle>[], node) => {
    // For style nodes, check if they matched the search
    if (node.type === 'style') {
      if (matchedStyleIds.has(node.data?.id || '')) {
        filtered.push(node);
      }
    } else if (node.type === 'library' || node.type === 'unstyled') {
      // For group nodes, filter children first
      const matchingChildren = filterTree(node.children, matchedStyleIds);
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

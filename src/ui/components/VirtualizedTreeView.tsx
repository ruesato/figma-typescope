/**
 * Virtualized Tree View Component (T123)
 *
 * Reference implementation using TanStack Virtual for enterprise-scale rendering.
 * Supports 1000+ nodes with <500ms render time and smooth scrolling.
 *
 * This can be adapted for StyleTreeView and TokenView (T124, T125).
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState, useEffect, useMemo } from 'react';
import type { TextStyle, TextLayer } from '@/shared/types';
import {
  OVERSCAN_COUNTS,
  ITEM_SIZES,
  shouldVirtualize,
  smoothScrollToItem,
  ScrollPerformanceMonitor,
} from '@/ui/utils/virtualization';

interface VirtualizedTreeNode {
  id: string;
  name: string;
  usageCount: number;
  level: number;
  children?: VirtualizedTreeNode[];
  isExpanded?: boolean;
  selected?: boolean;
}

interface VirtualizedTreeViewProps {
  nodes: VirtualizedTreeNode[];
  onSelectNode?: (node: VirtualizedTreeNode) => void;
  onExpandNode?: (nodeId: string, isExpanded: boolean) => void;
  renderNode?: (node: VirtualizedTreeNode, isExpanded: boolean) => React.ReactNode;
  maxHeight?: string;
}

/**
 * Flatten tree structure for virtualization
 * Only includes visible (expanded) nodes
 */
function flattenTree(nodes: VirtualizedTreeNode[], expanded: Set<string>): VirtualizedTreeNode[] {
  const flattened: VirtualizedTreeNode[] = [];

  function traverse(node: VirtualizedTreeNode) {
    flattened.push(node);
    if (expanded.has(node.id) && node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return flattened;
}

/**
 * Virtualized Tree View Component
 *
 * Efficiently renders large trees by only rendering visible nodes.
 * Supports 1000+ nodes with smooth scrolling.
 */
export default function VirtualizedTreeView({
  nodes,
  onSelectNode,
  onExpandNode,
  renderNode,
  maxHeight = '600px',
}: VirtualizedTreeViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const scrollMonitor = useRef(new ScrollPerformanceMonitor());

  // Flatten tree based on expanded state
  const flattenedNodes = useMemo(() => {
    return flattenTree(nodes, expanded);
  }, [nodes, expanded]);

  // Determine if virtualization is needed
  const shouldUseVirtualization = shouldVirtualize(flattenedNodes.length, 'tree');

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: flattenedNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZES.treeNode,
    overscan: OVERSCAN_COUNTS.tree,
    gap: 0,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Handle node expansion
  const handleToggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpanded(newExpanded);
    onExpandNode?.(nodeId, newExpanded.has(nodeId));
  };

  // Handle node selection
  const handleSelectNode = (node: VirtualizedTreeNode) => {
    setSelected(node.id);
    onSelectNode?.(node);
  };

  // Monitor scroll performance
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    let animationFrameId: number;
    const onScroll = () => {
      const fps = scrollMonitor.current.measureFrame();
      if (!scrollMonitor.current.isOptimal()) {
        console.warn(`Scroll performance degraded: ${fps}fps`);
      }
      animationFrameId = requestAnimationFrame(onScroll);
    };

    container.addEventListener('scroll', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // If small dataset, render without virtualization for simplicity
  if (!shouldUseVirtualization) {
    return (
      <div
        className="space-y-1 overflow-y-auto"
        style={{ maxHeight, contain: 'layout style paint' }}
      >
        {flattenedNodes.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            isExpanded={expanded.has(node.id)}
            isSelected={selected === node.id}
            onToggleExpand={() => handleToggleExpand(node.id)}
            onSelectNode={() => handleSelectNode(node)}
            renderNode={renderNode}
          />
        ))}
      </div>
    );
  }

  // Virtualized rendering
  return (
    <div
      ref={parentRef}
      className="overflow-y-auto"
      style={{
        maxHeight,
        contain: 'layout style paint',
        // Enable GPU acceleration
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const node = flattenedNodes[virtualItem.index];
          return (
            <div
              key={node.id}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <TreeNodeItem
                node={node}
                isExpanded={expanded.has(node.id)}
                isSelected={selected === node.id}
                onToggleExpand={() => handleToggleExpand(node.id)}
                onSelectNode={() => handleSelectNode(node)}
                renderNode={renderNode}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Individual Tree Node Item
 */
interface TreeNodeItemProps {
  node: VirtualizedTreeNode;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onSelectNode: () => void;
  renderNode?: (node: VirtualizedTreeNode, isExpanded: boolean) => React.ReactNode;
}

function TreeNodeItem({
  node,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelectNode,
  renderNode,
}: TreeNodeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = `${node.level * 16}px`;

  return (
    <div
      className={`
        flex items-center gap-1 px-2 py-1 cursor-pointer select-none
        hover:bg-figma-bg-secondary rounded
        ${isSelected ? 'bg-figma-bg-brand text-white' : 'text-figma-text'}
        transition-colors duration-150
      `}
      style={{ paddingLeft, height: '32px' }}
      onClick={onSelectNode}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSelectNode();
        } else if (e.key === ' ' && hasChildren) {
          e.preventDefault();
          onToggleExpand();
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`${node.name}, ${node.usageCount} usages`}
    >
      {/* Expand/collapse toggle */}
      {hasChildren && (
        <button
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-figma-bg-tertiary rounded"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>
      )}
      {!hasChildren && <div className="w-4" />}

      {/* Node content */}
      {renderNode ? (
        renderNode(node, isExpanded)
      ) : (
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <span className="truncate text-sm">{node.name}</span>
          <span className="flex-shrink-0 text-xs opacity-70">
            {node.usageCount} uses
          </span>
        </div>
      )}
    </div>
  );
}

export { VirtualizedTreeView };

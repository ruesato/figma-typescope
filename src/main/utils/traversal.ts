/**
 * Text node traversal utilities
 *
 * Provides functions to recursively traverse the Figma node tree
 * and collect text nodes for auditing.
 */

/**
 * Recursively traverse a node tree and collect all text nodes
 *
 * PERFORMANCE OPTIMIZED: Uses Figma's findAllWithCriteria when available,
 * which is 10-100x faster than manual recursion on large documents.
 *
 * @param node - Root node to start traversal from
 * @param cancelFn - Optional function that returns true if traversal should be cancelled
 * @returns Array of all text nodes found in the tree
 *
 * @example
 * ```ts
 * const textNodes = await traverseTextNodes(figma.currentPage);
 * console.log(`Found ${textNodes.length} text nodes`);
 * ```
 */
export async function traverseTextNodes(
  node: BaseNode,
  cancelFn?: () => boolean
): Promise<TextNode[]> {
  // Check for cancellation before starting
  if (cancelFn && cancelFn()) {
    return [];
  }

  // PERFORMANCE: Use Figma's optimized findAllWithCriteria when available
  // This is up to 100x faster than manual recursion on large documents
  // Reference: https://developers.figma.com/docs/plugins/api/properties/nodes-findallwithcriteria
  if ('findAllWithCriteria' in node) {
    try {
      const textNodes = (node as any).findAllWithCriteria({
        types: ['TEXT']
      }) as TextNode[];

      console.log(`[Performance] Found ${textNodes.length} text nodes using optimized findAllWithCriteria`);
      return textNodes;
    } catch (error) {
      console.warn('[Performance] findAllWithCriteria failed, falling back to recursive traversal:', error);
      // Fall through to recursive traversal
    }
  }

  // FALLBACK: Use recursive traversal for nodes that don't support findAllWithCriteria
  // or if the optimized method fails
  console.log('[Performance] Using recursive traversal (slower fallback)');
  const textNodes: TextNode[] = [];

  async function traverse(currentNode: BaseNode): Promise<void> {
    // Check for cancellation
    if (cancelFn && cancelFn()) {
      return;
    }

    // If this is a text node, add it to results
    if (currentNode.type === 'TEXT') {
      textNodes.push(currentNode as TextNode);
    }

    // Recursively traverse children if node has them
    if ('children' in currentNode) {
      const children = (currentNode as ChildrenMixin).children;
      for (const child of children) {
        await traverse(child);
      }
    }
  }

  await traverse(node);
  return textNodes;
}

/**
 * Options for streaming traversal
 */
export interface StreamingTraversalOptions {
  /** Function to check if operation should be cancelled */
  cancelFn?: () => boolean;
  /** Yield to event loop every N nodes (default: 50) */
  yieldEvery?: number;
  /** Callback when progress is made (processedCount) */
  onProgress?: (count: number) => void;
}

/**
 * Stream through text nodes without accumulating them in memory
 *
 * MEMORY OPTIMIZED: Uses callback pattern to process nodes one at a time,
 * avoiding the 75MB+ memory spike from collecting all nodes in an array.
 *
 * @param node - Root node to start traversal from
 * @param callback - Callback invoked for each text node (can be sync or async)
 * @param options - Traversal options including cancellation and yield frequency
 * @returns Total number of text nodes processed
 *
 * @example
 * ```ts
 * const styleIdToLayerIds = new Map<string, string[]>();
 *
 * await traverseTextNodesStreaming(
 *   figma.root,
 *   async (node) => {
 *     if (node.textStyleId) {
 *       const ids = styleIdToLayerIds.get(node.textStyleId) || [];
 *       ids.push(node.id);
 *       styleIdToLayerIds.set(node.textStyleId, ids);
 *     }
 *   },
 *   { yieldEvery: 50 }
 * );
 * ```
 */
export async function traverseTextNodesStreaming(
  node: BaseNode,
  callback: (node: TextNode) => void | Promise<void>,
  options?: StreamingTraversalOptions
): Promise<number> {
  const { cancelFn, yieldEvery = 50, onProgress } = options || {};
  let processedCount = 0;

  // Check for cancellation before starting
  if (cancelFn?.()) {
    return 0;
  }

  async function traverse(currentNode: BaseNode): Promise<void> {
    // Check for cancellation
    if (cancelFn?.()) {
      return;
    }

    // If this is a text node, process it via callback
    if (currentNode.type === 'TEXT') {
      await callback(currentNode as TextNode);
      processedCount++;

      // Report progress
      if (onProgress && processedCount % 100 === 0) {
        onProgress(processedCount);
      }

      // Yield periodically to allow GC and prevent UI freeze
      if (processedCount % yieldEvery === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Recursively traverse children if node has them
    if ('children' in currentNode) {
      const children = (currentNode as ChildrenMixin).children;
      for (const child of children) {
        await traverse(child);
        // Check for cancellation after each child
        if (cancelFn?.()) {
          return;
        }
      }
    }
  }

  console.log(`[Performance] Starting streaming traversal with yield every ${yieldEvery} nodes`);
  await traverse(node);
  console.log(`[Performance] Streaming traversal complete: processed ${processedCount} text nodes`);

  return processedCount;
}

/**
 * Get text nodes from current selection or page
 *
 * @param scope - Whether to use 'selection' or 'page'
 * @param cancelFn - Optional function that returns true if traversal should be cancelled
 * @returns Array of text nodes and metadata about the scope
 * @throws Error if selection is empty when scope is 'selection'
 *
 * @example
 * ```ts
 * const { textNodes, scopeName } = await getTextNodesFromScope('page');
 * console.log(`Found ${textNodes.length} text nodes in ${scopeName}`);
 * ```
 */
export async function getTextNodesFromScope(
  scope: 'page' | 'selection',
  cancelFn?: () => boolean
): Promise<{ textNodes: TextNode[]; scopeName: string }> {
  if (scope === 'selection') {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      throw new Error('No selection. Please select at least one layer.');
    }

    // Traverse all selected nodes
    const allTextNodes: TextNode[] = [];
    for (const node of selection) {
      const nodesInSelection = await traverseTextNodes(node, cancelFn);
      allTextNodes.push(...nodesInSelection);
    }

    return {
      textNodes: allTextNodes,
      scopeName: `Selection (${selection.length} layer${
        selection.length === 1 ? '' : 's'
      })`,
    };
  } else {
    // scope === 'page'
    const textNodes = await traverseTextNodes(figma.currentPage, cancelFn);
    return {
      textNodes,
      scopeName: figma.currentPage.name,
    };
  }
}

/**
 * Count total nodes in a tree (for progress calculation)
 *
 * @param node - Root node to count from
 * @returns Total number of nodes in the tree
 */
export function countNodes(node: BaseNode): number {
  let count = 1;

  if ('children' in node) {
    const children = (node as ChildrenMixin).children;
    for (const child of children) {
      count += countNodes(child);
    }
  }

  return count;
}

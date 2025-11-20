/**
 * Text node traversal utilities
 *
 * Provides functions to recursively traverse the Figma node tree
 * and collect text nodes for auditing.
 */

/**
 * Recursively traverse a node tree and collect all text nodes
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

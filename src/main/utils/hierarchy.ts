import type { ComponentContext } from '@/shared/types';

/**
 * Build component hierarchy path for a text node
 *
 * Traverses up the node tree to build a breadcrumb path from root to leaf.
 * Example: ["Page Name", "Card Component", "Button Instance", "Label"]
 *
 * @param node - The text node to build hierarchy for
 * @returns ComponentContext with type, path, and override status
 */
export function buildComponentHierarchy(node: TextNode): ComponentContext {
  const hierarchyPath: string[] = [];
  let currentNode: BaseNode | null = node;
  let componentType: ComponentContext['componentType'] = 'plain';
  let overrideStatus: ComponentContext['overrideStatus'] = 'default';

  // Traverse up the tree
  while (currentNode) {
    // Add node name to path
    if ('name' in currentNode) {
      hierarchyPath.unshift(currentNode.name);
    }

    // Check component type
    if (currentNode.type === 'COMPONENT') {
      componentType = 'main-component';
    } else if (currentNode.type === 'INSTANCE') {
      componentType = 'instance';

      // Check override status for instances
      const instance = currentNode as InstanceNode;
      if (instance.mainComponent) {
        // Check if text node has overrides
        const textNodeId = node.id;
        const hasOverrides = instance.overrides.some((override) =>
          override.id.includes(textNodeId)
        );

        if (hasOverrides) {
          overrideStatus = 'overridden';
        }
      } else {
        // Instance is detached
        overrideStatus = 'detached';
      }
    }

    // Move to parent
    currentNode = 'parent' in currentNode ? currentNode.parent : null;
  }

  return {
    componentType,
    hierarchyPath,
    overrideStatus,
  };
}

/**
 * Get a formatted hierarchy path string for display
 *
 * @param hierarchyPath - Array of node names from root to leaf
 * @returns Formatted string (e.g., "Page → Card → Button → Label")
 */
export function formatHierarchyPath(hierarchyPath: string[]): string {
  return hierarchyPath.join(' → ');
}

/**
 * Check if a node is inside a component (main or instance)
 *
 * @param node - The node to check
 * @returns True if node is inside any component
 */
export function isInComponent(node: BaseNode): boolean {
  let currentNode: BaseNode | null = node;

  while (currentNode) {
    if (currentNode.type === 'COMPONENT' || currentNode.type === 'INSTANCE') {
      return true;
    }
    currentNode = 'parent' in currentNode ? currentNode.parent : null;
  }

  return false;
}

/**
 * Node Categorization Utility
 *
 * Shared logic for categorizing text nodes based on component/instance hierarchy.
 * Used by both conversion and replacement engines for component-aware processing.
 *
 * Memory optimizations:
 * - Processes nodes in batches
 * - Yields for GC
 * - Caches main component lookups
 * - Explicit cleanup
 */

import { yieldForGC, releaseArray } from '../conversion/memoryUtils';

/**
 * Node categorization for component-aware processing
 */
export interface TextNodeCategory {
  localMainComponent: string[];      // Update first (triggers propagation)
  libraryInstance: string[];         // Must update (can't modify library main)
  detachedInstance: string[];        // Must update (no main component)
  localInstanceWithOverride: string[]; // Must update (has textStyleId override)
  localInstanceNoOverride: string[]; // SKIP (will inherit from main)
  plainText: string[];               // Must update (not in component)
}

/**
 * Cache for main component lookups to avoid redundant API calls
 */
const mainComponentCache = new Map<string, { isLibrary: boolean; mainComponent: ComponentNode | null }>();

/**
 * Clear the main component cache
 * Should be called when processing is complete
 */
export function clearMainComponentCache(): void {
  mainComponentCache.clear();
}

/**
 * Get the current cache size (for logging/debugging)
 */
export function getMainComponentCacheSize(): number {
  return mainComponentCache.size;
}

/**
 * Check if a text node has a textStyleId override in an instance
 *
 * CONSERVATIVE: Only returns true if we're certain there's an override.
 * When uncertain, returns false to trigger an update (safer).
 */
function hasTextStyleOverride(textNode: TextNode, instance: InstanceNode): boolean {
  if (!instance.overrides || instance.overrides.length === 0) {
    return false;
  }

  const textNodeId = textNode.id;

  return instance.overrides.some((override: any) => {
    // Pattern 1: Override ID matches text node ID
    if (override.id === textNodeId) {
      if (override.overriddenFields) {
        return override.overriddenFields.includes('textStyleId');
      }
      return true;
    }

    // Pattern 2: Override ID contains text node ID (for nested overrides)
    if (typeof override.id === 'string' && override.id.includes(textNodeId)) {
      return true;
    }

    return false;
  });
}

/**
 * Check if an instance's main component is from a library (with caching)
 */
async function isLibraryComponent(instance: InstanceNode): Promise<boolean> {
  try {
    const mainComponentId = instance.mainComponent?.id;
    if (!mainComponentId) {
      return false;
    }

    // Check cache first
    if (mainComponentCache.has(mainComponentId)) {
      const cached = mainComponentCache.get(mainComponentId)!;
      return cached.isLibrary;
    }

    // Cache miss - fetch the main component
    const mainComponent = await instance.getMainComponentAsync();
    const isLibrary = mainComponent?.remote === true;

    // Cache the result
    mainComponentCache.set(mainComponentId, { isLibrary, mainComponent });

    return isLibrary;
  } catch (error) {
    console.warn('[NodeCategorization] Failed to check if component is from library:', error);
    // Conservative: assume it's a library component (so we update the instance)
    return true;
  }
}

/**
 * Categorize a single text node based on its component/instance context
 */
async function categorizeSingleNode(
  textNode: TextNode,
  layerId: string,
  categories: TextNodeCategory
): Promise<void> {
  let categorized = false;

  // Walk up parent hierarchy to find component/instance context
  let current: BaseNode | null = textNode;
  while (current && current.parent) {
    current = current.parent;

    // Case 1: Text is inside a LOCAL main component
    if (current.type === 'COMPONENT') {
      const component = current as ComponentNode;
      if (!component.remote) {
        categories.localMainComponent.push(layerId);
        categorized = true;
        break;
      }
    }

    // Case 2: Text is inside an instance
    if (current.type === 'INSTANCE') {
      const instance = current as InstanceNode;

      // Check if instance is detached (no main component)
      const mainComponent = await instance.getMainComponentAsync();
      if (!mainComponent) {
        categories.detachedInstance.push(layerId);
        categorized = true;
        break;
      }

      // Check if main component is from library (uses cache)
      const isLibrary = await isLibraryComponent(instance);
      if (isLibrary) {
        categories.libraryInstance.push(layerId);
        categorized = true;
        break;
      }

      // Main component is local - check for textStyleId override
      const hasOverride = hasTextStyleOverride(textNode, instance);
      if (hasOverride) {
        categories.localInstanceWithOverride.push(layerId);
      } else {
        categories.localInstanceNoOverride.push(layerId);
      }
      categorized = true;
      break;
    }

    // Stop at page level
    if (current.type === 'PAGE') {
      break;
    }
  }

  // Case 3: Plain text (not in any component/instance)
  if (!categorized) {
    categories.plainText.push(layerId);
  }
}

/**
 * Categorize text nodes for component-aware processing
 *
 * CONSERVATIVE APPROACH: When uncertain about node type or override status,
 * we err on the side of updating the node rather than skipping it.
 *
 * MEMORY OPTIMIZATION: Processes nodes in batches with explicit cleanup and GC yields.
 *
 * @param layerIds - Array of text layer IDs to categorize
 * @param options - Optional configuration
 * @returns Categorized node IDs
 */
export async function categorizeTextNodes(
  layerIds: string[],
  options?: {
    cancelFn?: () => boolean;
    logPrefix?: string;
  }
): Promise<TextNodeCategory> {
  const { cancelFn, logPrefix = 'NodeCategorization' } = options || {};

  const categories: TextNodeCategory = {
    localMainComponent: [],
    libraryInstance: [],
    detachedInstance: [],
    localInstanceWithOverride: [],
    localInstanceNoOverride: [],
    plainText: [],
  };

  console.log(`[${logPrefix}] Categorizing ${layerIds.length} text nodes...`);

  // MEMORY OPTIMIZATION: Process in batches to control memory usage
  // Figma recommends batch size of 50 for large operations
  const BATCH_SIZE = 50;
  const YIELD_EVERY = 50; // Yield for GC every 50 nodes processed

  let processedCount = 0;
  let nodes: (SceneNode | null)[] = [];

  for (let i = 0; i < layerIds.length; i += BATCH_SIZE) {
    // Check for cancellation
    if (cancelFn?.()) {
      console.log(`[${logPrefix}] Categorization cancelled`);
      break;
    }

    const batchIds = layerIds.slice(i, Math.min(i + BATCH_SIZE, layerIds.length));

    // Load nodes for this batch in parallel
    nodes = await Promise.all(
      batchIds.map(async (id) => {
        try {
          return await figma.getNodeByIdAsync(id);
        } catch (error) {
          return null; // Node may have been deleted
        }
      })
    );

    // Categorize each node in the batch
    for (let j = 0; j < nodes.length; j++) {
      const node = nodes[j];
      const layerId = batchIds[j];

      if (!node || node.type !== 'TEXT') {
        continue;
      }

      try {
        await categorizeSingleNode(node as TextNode, layerId, categories);
      } catch (error) {
        console.warn(`[${logPrefix}] Error categorizing node ${layerId}:`, error);
        // Conservative: if we can't categorize, treat as plain text (will be updated)
        categories.plainText.push(layerId);
      }

      processedCount++;

      // Yield for GC every YIELD_EVERY nodes
      if (processedCount % YIELD_EVERY === 0) {
        await yieldForGC();
      }
    }

    // MEMORY OPTIMIZATION: Explicit cleanup after each batch
    releaseArray(nodes);
  }

  console.log(`[${logPrefix}] Categorization complete:`, {
    localMainComponent: categories.localMainComponent.length,
    libraryInstance: categories.libraryInstance.length,
    detachedInstance: categories.detachedInstance.length,
    localInstanceWithOverride: categories.localInstanceWithOverride.length,
    localInstanceNoOverride: categories.localInstanceNoOverride.length,
    plainText: categories.plainText.length,
  });

  return categories;
}

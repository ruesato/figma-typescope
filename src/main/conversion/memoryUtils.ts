/**
 * Memory Management Utilities
 *
 * Utilities for managing memory during intensive operations in the Figma plugin sandbox.
 * These utilities help prevent "out of memory" errors by:
 * - Releasing array references explicitly
 * - Yielding to event loop to allow garbage collection
 * - Processing items in memory-efficient chunks
 */

/**
 * Release array references and clear memory
 *
 * Explicitly clears an array to release references to its elements,
 * allowing the garbage collector to reclaim memory.
 *
 * @param arr - Array to clear
 */
export function releaseArray<T>(arr: T[]): void {
  arr.length = 0;
}

/**
 * Yield to event loop, allowing garbage collection
 *
 * Pauses execution briefly to allow the JavaScript event loop to process
 * pending tasks and the garbage collector to run. This is critical for
 * preventing memory buildup during long-running operations.
 *
 * @returns Promise that resolves after yielding
 */
export async function yieldForGC(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Explicit GC hint if available (Figma plugin sandbox may support this)
  // Note: This is typically only available in Node.js with --expose-gc flag
  if (typeof global !== 'undefined' && (global as any).gc) {
    (global as any).gc();
  }
}

/**
 * Process items in chunks with automatic GC yields
 *
 * Generator function that yields chunks of an array, automatically
 * yielding to the event loop between chunks to allow garbage collection.
 *
 * @param array - Array to process in chunks
 * @param chunkSize - Size of each chunk
 * @yields Chunks of the array
 *
 * @example
 * ```typescript
 * for await (const chunk of chunkArray(largeArray, 100)) {
 *   // Process chunk of 100 items
 *   await processItems(chunk);
 * }
 * ```
 */
export async function* chunkArray<T>(
  array: T[],
  chunkSize: number
): AsyncGenerator<T[], void, unknown> {
  for (let i = 0; i < array.length; i += chunkSize) {
    yield array.slice(i, i + chunkSize);
    await yieldForGC();
  }
}

/**
 * Batch retrieve Figma nodes by ID with memory-efficient chunking
 *
 * Retrieves nodes from Figma in batches to avoid loading too many
 * node objects into memory at once.
 *
 * @param nodeIds - Array of node IDs to retrieve
 * @param batchSize - Number of nodes to retrieve per batch (default: 100)
 * @returns Array of retrieved nodes (may include null for deleted nodes)
 *
 * @example
 * ```typescript
 * const layerIds = ['123', '456', '789'];
 * const nodes = await batchGetNodesByIds(layerIds, 50);
 * ```
 */
export async function batchGetNodesByIds(
  nodeIds: string[],
  batchSize: number = 100
): Promise<(BaseNode | null)[]> {
  const results: (BaseNode | null)[] = [];

  for await (const chunk of chunkArray(nodeIds, batchSize)) {
    const nodes = await Promise.all(chunk.map((id) => figma.getNodeByIdAsync(id)));
    results.push(...nodes);

    // Release chunk references
    chunk.length = 0;
  }

  return results;
}

/**
 * Monitor memory usage if available
 *
 * Returns current memory usage information if the performance.memory API
 * is available (Chrome/Chromium-based browsers).
 *
 * @returns Memory usage info or null if unavailable
 */
export function getMemoryUsage(): { usedMB: number; totalMB: number } | null {
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const memory = (performance as any).memory;
    return {
      usedMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      totalMB: Math.round(memory.totalJSHeapSize / 1024 / 1024),
    };
  }
  return null;
}

/**
 * Log memory usage for debugging
 *
 * Logs current memory usage if available, useful for tracking
 * memory consumption during operations.
 *
 * @param label - Label for the log message
 */
export function logMemoryUsage(label: string): void {
  const usage = getMemoryUsage();
  if (usage) {
    console.log(`[MEMORY] ${label}: ${usage.usedMB}MB / ${usage.totalMB}MB`);
  }
}

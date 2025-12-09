/**
 * Progressive Batch Loader (T126, T127)
 *
 * Implements progressive loading for enterprise-scale documents (10k-50k layers).
 * Loads data in batches using requestIdleCallback with reduced progress update frequency
 * for large datasets to prevent excessive message passing overhead.
 *
 * Targets:
 * - 5k layers: <100ms batch processing
 * - 10k layers: <200ms batch processing
 * - 25k layers: <500ms batch processing
 * - 50k layers: <1s batch processing
 * - Progress updates: Every 50 items (for 10k+ datasets)
 */

import type { TextLayer } from '@/shared/types';
import { getOptimalBatchSize } from '@/ui/utils/virtualization';

// ============================================================================
// Progressive Batch Loader
// ============================================================================

export interface ProgressCallback {
  (progress: {
    itemsProcessed: number;
    totalItems: number;
    percentComplete: number;
    batchesCompleted: number;
    totalBatches: number;
  }): void;
}

export interface BatchLoaderOptions {
  onProgress?: ProgressCallback;
  onComplete?: (results: any[]) => void;
  onError?: (error: Error) => void;
  progressUpdateFrequency?: number; // Number of items between progress updates (default: 50)
}

/**
 * Load items progressively in batches using requestIdleCallback
 *
 * For large datasets (10k+), reduces progress updates to every 50 items
 * to minimize message passing overhead.
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item
 * @param options - Configuration options
 */
export async function progressivelyLoadItems<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R> | R,
  options: BatchLoaderOptions = {}
): Promise<R[]> {
  const {
    onProgress,
    onComplete,
    onError,
    progressUpdateFrequency = 50,
  } = options;

  const totalItems = items.length;
  const batchSize = getOptimalBatchSize(totalItems);
  const totalBatches = Math.ceil(totalItems / batchSize);
  const results: R[] = [];
  let processedCount = 0;
  let batchesCompleted = 0;
  let lastProgressUpdate = 0;

  try {
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, totalItems);
      const batch = items.slice(start, end);

      // Load first batch immediately for better UX
      if (batchIndex === 0) {
        for (let i = 0; i < batch.length; i++) {
          const result = await Promise.resolve(processor(batch[i], start + i));
          results.push(result);
          processedCount++;

          // Update progress at configured frequency
          if (processedCount - lastProgressUpdate >= progressUpdateFrequency) {
            onProgress?.({
              itemsProcessed: processedCount,
              totalItems,
              percentComplete: Math.round((processedCount / totalItems) * 100),
              batchesCompleted,
              totalBatches,
            });
            lastProgressUpdate = processedCount;
          }
        }
      } else {
        // Load remaining batches in background with requestIdleCallback
        await new Promise<void>((resolve) => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(
              async () => {
                for (let i = 0; i < batch.length; i++) {
                  const result = await Promise.resolve(processor(batch[i], start + i));
                  results.push(result);
                  processedCount++;

                  // Update progress at configured frequency
                  if (processedCount - lastProgressUpdate >= progressUpdateFrequency) {
                    onProgress?.({
                      itemsProcessed: processedCount,
                      totalItems,
                      percentComplete: Math.round((processedCount / totalItems) * 100),
                      batchesCompleted,
                      totalBatches,
                    });
                    lastProgressUpdate = processedCount;
                  }
                }
                batchesCompleted++;
                resolve();
              },
              { timeout: 1000 } // Timeout prevents long delays in busy browsers
            );
          } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(async () => {
              for (let i = 0; i < batch.length; i++) {
                const result = await Promise.resolve(processor(batch[i], start + i));
                results.push(result);
                processedCount++;

                // Update progress at configured frequency
                if (processedCount - lastProgressUpdate >= progressUpdateFrequency) {
                  onProgress?.({
                    itemsProcessed: processedCount,
                    totalItems,
                    percentComplete: Math.round((processedCount / totalItems) * 100),
                    batchesCompleted,
                    totalBatches,
                  });
                  lastProgressUpdate = processedCount;
                }
              }
              batchesCompleted++;
              resolve();
            }, 0);
          }
        });
      }
    }

    // Final progress update
    if (processedCount > lastProgressUpdate) {
      onProgress?.({
        itemsProcessed: processedCount,
        totalItems,
        percentComplete: 100,
        batchesCompleted: totalBatches,
        totalBatches,
      });
    }

    onComplete?.(results);
    return results;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}

/**
 * Process layers in batches with optional callback
 *
 * Specialized for TextLayer processing with reduced progress updates
 * for large documents (T127).
 *
 * @param layers - Array of text layers to process
 * @param processor - Function to process each layer
 * @param onProgress - Optional callback for progress updates
 */
export async function processLayersInBatches<R>(
  layers: TextLayer[],
  processor: (layer: TextLayer, index: number) => Promise<R> | R,
  onProgress?: ProgressCallback
): Promise<R[]> {
  // For large datasets (10k+), reduce progress updates to every 50 layers (T127)
  const progressFrequency = layers.length > 10000 ? 50 : 25;

  return progressivelyLoadItems(layers, processor, {
    onProgress,
    progressUpdateFrequency: progressFrequency,
  });
}

/**
 * Get optimized progress update frequency for dataset size
 *
 * Implements T127: Reduce progress update frequency for large datasets
 */
export function getProgressUpdateFrequency(itemCount: number): number {
  if (itemCount < 5000) return 25; // Update every 25 items
  if (itemCount < 10000) return 30; // Update every 30 items
  if (itemCount < 25000) return 50; // Update every 50 items
  return 100; // Update every 100 items for 50k datasets
}

/**
 * Process items with rate limiting to prevent blocking
 *
 * Useful for CPU-intensive operations that shouldn't block the main thread.
 */
export async function processWithRateLimit<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R> | R,
  itemsPerFrame: number = 10,
  onProgress?: ProgressCallback
): Promise<R[]> {
  const results: R[] = [];
  const totalItems = items.length;
  let processedCount = 0;

  for (let i = 0; i < totalItems; i += itemsPerFrame) {
    const batch = items.slice(i, i + itemsPerFrame);

    // Process batch items
    for (let j = 0; j < batch.length; j++) {
      const result = await Promise.resolve(processor(batch[j], i + j));
      results.push(result);
      processedCount++;
    }

    // Emit progress
    onProgress?.({
      itemsProcessed: processedCount,
      totalItems,
      percentComplete: Math.round((processedCount / totalItems) * 100),
      batchesCompleted: Math.ceil(processedCount / itemsPerFrame),
      totalBatches: Math.ceil(totalItems / itemsPerFrame),
    });

    // Yield to browser to prevent blocking
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return results;
}

/**
 * Analyze batch processing performance
 */
export function analyzeBatchPerformance(
  totalItems: number,
  duration: number
): {
  msPerItem: number;
  itemsPerSecond: number;
  estimatedTotal5k: number;
  estimatedTotal10k: number;
  estimatedTotal50k: number;
  isOptimal: boolean;
} {
  const msPerItem = duration / totalItems;
  const itemsPerSecond = (totalItems / duration) * 1000;

  return {
    msPerItem,
    itemsPerSecond,
    estimatedTotal5k: msPerItem * 5000,
    estimatedTotal10k: msPerItem * 10000,
    estimatedTotal50k: msPerItem * 50000,
    isOptimal: msPerItem < 0.2, // Target: <0.2ms per item
  };
}

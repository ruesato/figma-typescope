/**
 * Batch Processor with Adaptive Sizing
 *
 * Processes layers in batches with adaptive sizing:
 * - Start: 100 layers/batch
 * - On error: Reduce to 25 layers/batch
 * - After 5 consecutive successes: Increase back toward 100
 *
 * This balances performance (large batches) with reliability (small batches on errors).
 */

// ============================================================================
// Types
// ============================================================================

export interface BatchProcessorOptions {
  initialBatchSize?: number; // Default: 100
  minBatchSize?: number; // Default: 25
  maxBatchSize?: number; // Default: 100
  successThreshold?: number; // Successes before increasing (default: 5)
  onBatchComplete?: (result: BatchResult) => void;
  onBatchError?: (error: Error, batchNumber: number) => void;
}

export interface BatchResult {
  batchNumber: number;
  batchSize: number;
  layersProcessed: number;
  layersFailed: number;
  errors: BatchError[];
  duration: number;
}

export interface BatchError {
  layerId: string;
  layerName: string;
  error: Error;
  retryCount: number;
}

export type BatchOperation<T> = (item: T) => Promise<void>;

// ============================================================================
// Batch Processor
// ============================================================================

export class BatchProcessor {
  private currentBatchSize: number;
  private consecutiveSuccesses: number = 0;
  private options: Required<BatchProcessorOptions>;

  constructor(options: BatchProcessorOptions = {}) {
    this.options = {
      initialBatchSize: options.initialBatchSize ?? 100,
      minBatchSize: options.minBatchSize ?? 25,
      maxBatchSize: options.maxBatchSize ?? 100,
      successThreshold: options.successThreshold ?? 5,
      onBatchComplete: options.onBatchComplete ?? (() => {}),
      onBatchError: options.onBatchError ?? (() => {}),
    };

    this.currentBatchSize = this.options.initialBatchSize;
  }

  /**
   * Process items in adaptive batches
   *
   * @param items - Array of items to process
   * @param operation - Operation to perform on each item
   * @yields BatchResult for each batch processed
   */
  async *processBatches<T>(
    items: T[],
    operation: BatchOperation<T>
  ): AsyncIterableIterator<BatchResult> {
    let batchNumber = 0;
    let totalProcessed = 0;

    console.log(
      `Starting batch processing: ${items.length} items, initial batch size: ${this.currentBatchSize}`
    );

    while (totalProcessed < items.length) {
      batchNumber++;
      const batchStartTime = Date.now();

      // Get current batch
      const batchItems = items.slice(totalProcessed, totalProcessed + this.currentBatchSize);
      const batchSize = batchItems.length;

      console.log(
        `Processing batch ${batchNumber}: ${batchSize} items (${totalProcessed}/${items.length})`
      );

      // Process batch
      const result = await this.processBatch(batchItems, operation, batchNumber);

      // Update processed count
      totalProcessed += batchSize;

      // Adapt batch size based on result
      this.adaptBatchSize(result);

      // Emit result
      yield result;

      // Call completion callback
      this.options.onBatchComplete(result);

      // Small delay to prevent blocking
      await this.delay(10);
    }

    console.log(
      `Batch processing complete: ${batchNumber} batches, final size: ${this.currentBatchSize}`
    );
  }

  /**
   * Process a single batch of items
   */
  private async processBatch<T>(
    items: T[],
    operation: BatchOperation<T>,
    batchNumber: number
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const errors: BatchError[] = [];
    let layersProcessed = 0;
    let layersFailed = 0;

    for (const item of items) {
      try {
        await operation(item);
        layersProcessed++;
      } catch (error) {
        layersFailed++;
        errors.push({
          layerId: this.extractLayerId(item),
          layerName: this.extractLayerName(item),
          error: error instanceof Error ? error : new Error(String(error)),
          retryCount: 0,
        });
      }
    }

    const duration = Date.now() - startTime;

    return {
      batchNumber,
      batchSize: items.length,
      layersProcessed,
      layersFailed,
      errors,
      duration,
    };
  }

  /**
   * Adapt batch size based on batch result
   *
   * Algorithm:
   * - If errors occurred: reduce to minBatchSize
   * - If no errors: increment consecutive successes
   * - After successThreshold successes: increase batch size by 25 (max: maxBatchSize)
   */
  private adaptBatchSize(result: BatchResult): void {
    const { layersFailed } = result;

    if (layersFailed > 0) {
      // Errors detected - reduce batch size
      const oldSize = this.currentBatchSize;
      this.currentBatchSize = this.options.minBatchSize;
      this.consecutiveSuccesses = 0;

      console.log(
        `Batch errors detected (${layersFailed} failed), reducing batch size: ${oldSize} → ${this.currentBatchSize}`
      );
    } else {
      // No errors - increment success counter
      this.consecutiveSuccesses++;

      // After threshold successes, increase batch size
      if (this.consecutiveSuccesses >= this.options.successThreshold) {
        const oldSize = this.currentBatchSize;
        this.currentBatchSize = Math.min(this.currentBatchSize + 25, this.options.maxBatchSize);
        this.consecutiveSuccesses = 0;

        if (oldSize !== this.currentBatchSize) {
          console.log(
            `${this.options.successThreshold} consecutive successes, increasing batch size: ${oldSize} → ${this.currentBatchSize}`
          );
        }
      }
    }
  }

  /**
   * Extract layer ID from item (assumes item has id property or is string)
   */
  private extractLayerId<T>(item: T): string {
    if (typeof item === 'string') {
      return item;
    }
    if (item && typeof item === 'object' && 'id' in item) {
      return String((item as any).id);
    }
    return 'unknown';
  }

  /**
   * Extract layer name from item (assumes item has name property)
   */
  private extractLayerName<T>(item: T): string {
    if (item && typeof item === 'object' && 'name' in item) {
      return String((item as any).name);
    }
    return 'Unknown';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current batch size
   */
  getCurrentBatchSize(): number {
    return this.currentBatchSize;
  }

  /**
   * Get consecutive successes count
   */
  getConsecutiveSuccesses(): number {
    return this.consecutiveSuccesses;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentBatchSize = this.options.initialBatchSize;
    this.consecutiveSuccesses = 0;
  }
}

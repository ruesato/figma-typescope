/**
 * Error Recovery Module
 *
 * Classifies errors and implements retry strategies with exponential backoff.
 * Helps distinguish between transient errors (retry) and persistent errors (fail fast).
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorType = 'transient' | 'persistent' | 'validation' | 'partial';

export interface RetryStrategy {
  maxRetries: number;
  backoffDelays: number[]; // [1000, 2000, 4000] ms
  shouldRetry: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attemptCount: number;
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classify error type to determine handling strategy
 *
 * @param error - Error to classify
 * @returns ErrorType classification
 */
export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();

  // Transient errors - temporary issues that may resolve on retry
  if (
    message.includes('timeout') ||
    message.includes('429') || // Rate limit
    message.includes('503') || // Service unavailable
    message.includes('network') ||
    message.includes('connection')
  ) {
    return 'transient';
  }

  // Validation errors - input problems
  if (
    message.includes('invalid') ||
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('cannot be the same')
  ) {
    return 'validation';
  }

  // Partial errors - individual item failures
  if (
    message.includes('locked') ||
    message.includes('read-only') ||
    message.includes('not a text layer')
  ) {
    return 'partial';
  }

  // Persistent errors - issues that won't resolve with retry
  if (
    message.includes('permission') ||
    message.includes('access denied') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  ) {
    return 'persistent';
  }

  // Default to persistent for safety (avoid infinite retries)
  return 'persistent';
}

/**
 * Check if error should be retried
 *
 * @param error - Error to check
 * @returns True if error is transient and should be retried
 */
export function shouldRetryError(error: Error): boolean {
  const errorType = classifyError(error);
  return errorType === 'transient';
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Default retry strategy with exponential backoff
 */
export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxRetries: 3,
  backoffDelays: [1000, 2000, 4000], // 1s, 2s, 4s
  shouldRetry: shouldRetryError,
};

/**
 * Retry an operation with exponential backoff
 *
 * @param operation - Async operation to retry
 * @param strategy - Retry configuration (optional)
 * @returns Result with success status and attempt count
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(async () => {
 *   return await someRiskyOperation();
 * });
 *
 * if (result.success) {
 *   console.log('Success after', result.attemptCount, 'attempts');
 * } else {
 *   console.error('Failed after', result.attemptCount, 'attempts:', result.error);
 * }
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  strategy: RetryStrategy = DEFAULT_RETRY_STRATEGY
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
    try {
      const result = await operation();
      return {
        success: true,
        result,
        attemptCount: attempt + 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const isLastAttempt = attempt === strategy.maxRetries;
      const shouldRetry = strategy.shouldRetry(lastError);

      if (isLastAttempt || !shouldRetry) {
        // Don't retry - return failure
        console.warn(
          `Operation failed after ${attempt + 1} attempt(s):`,
          lastError.message,
          shouldRetry ? '(max retries reached)' : '(non-retryable error)'
        );
        return {
          success: false,
          error: lastError,
          attemptCount: attempt + 1,
        };
      }

      // Retry with backoff
      const delay =
        strategy.backoffDelays[attempt] ||
        strategy.backoffDelays[strategy.backoffDelays.length - 1];
      console.log(
        `Attempt ${attempt + 1} failed (${lastError.message}), retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attemptCount: strategy.maxRetries + 1,
  };
}

/**
 * Sleep helper
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Batch Retry Logic
// ============================================================================

/**
 * Retry a batch operation with reduced batch size
 *
 * If a batch fails, splits it into smaller batches and retries each.
 * Useful for recovering from batch size issues.
 *
 * @param items - Items to process
 * @param operation - Operation to perform on each item
 * @param initialBatchSize - Size of each batch
 * @param minBatchSize - Minimum batch size for retries
 * @returns Array of results for each item
 */
export async function retryBatchWithReduction<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  initialBatchSize: number = 100,
  minBatchSize: number = 25
): Promise<Array<{ success: boolean; result?: R; error?: Error }>> {
  const results: Array<{ success: boolean; result?: R; error?: Error }> = [];
  let currentBatchSize = initialBatchSize;

  for (let i = 0; i < items.length; i += currentBatchSize) {
    const batch = items.slice(i, i + currentBatchSize);

    try {
      // Process batch
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            const result = await operation(item);
            return { success: true, result };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error : new Error(String(error)),
            };
          }
        })
      );

      results.push(...batchResults);
    } catch (error) {
      // Batch failed completely - reduce size and retry
      if (currentBatchSize > minBatchSize) {
        console.warn(
          `Batch failed, reducing size from ${currentBatchSize} to ${minBatchSize} and retrying`
        );
        currentBatchSize = minBatchSize;
        i -= initialBatchSize; // Retry this batch
      } else {
        // Already at minimum size - record failures
        console.error('Batch failed at minimum size, recording failures');
        results.push(
          ...batch.map(() => ({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }))
        );
      }
    }
  }

  return results;
}

// ============================================================================
// Error Reporting
// ============================================================================

/**
 * Create user-friendly error message
 *
 * @param error - Error to format
 * @param context - Additional context
 * @returns User-friendly error message
 */
export function formatErrorMessage(error: Error, context?: string): string {
  const errorType = classifyError(error);
  const prefix = context ? `${context}: ` : '';

  switch (errorType) {
    case 'transient':
      return `${prefix}Temporary issue (${error.message}). Please try again.`;
    case 'persistent':
      return `${prefix}Operation cannot complete (${error.message}). Please check permissions and settings.`;
    case 'validation':
      return `${prefix}Invalid input (${error.message}). Please verify your selection.`;
    case 'partial':
      return `${prefix}Some items could not be processed (${error.message}).`;
    default:
      return `${prefix}${error.message}`;
  }
}

/**
 * Aggregate errors from multiple operations
 *
 * @param errors - Array of errors
 * @returns Summary of error types and counts
 */
export function aggregateErrors(errors: Error[]): {
  transient: number;
  persistent: number;
  validation: number;
  partial: number;
  total: number;
  messages: string[];
} {
  const summary = {
    transient: 0,
    persistent: 0,
    validation: 0,
    partial: 0,
    total: errors.length,
    messages: [] as string[],
  };

  const uniqueMessages = new Set<string>();

  for (const error of errors) {
    const errorType = classifyError(error);
    summary[errorType]++;

    // Collect unique error messages
    if (!uniqueMessages.has(error.message)) {
      uniqueMessages.add(error.message);
      summary.messages.push(error.message);
    }
  }

  return summary;
}

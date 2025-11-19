/**
 * Exponential backoff retry utility
 *
 * Implements retry logic with exponential backoff (1s, 2s, 4s intervals)
 * as specified in FR-014.
 */

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  maxAttempts?: number; // Default: 3
  delays?: number[]; // Default: [1000, 2000, 4000] (1s, 2s, 4s)
  onRetry?: (attempt: number, error: Error) => void; // Callback on each retry
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns Promise resolving to the function's return value
 * @throws Error if all retry attempts fail
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   () => figma.loadFontAsync(fontName),
 *   {
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, delays = [1000, 2000, 4000], onRetry } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        // Call retry callback if provided
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        // Wait before next attempt
        const delay = delays[attempt - 1] || delays[delays.length - 1];
        await sleep(delay);
      }
    }
  }

  // All attempts failed
  throw new Error(
    `Failed after ${maxAttempts} attempts. Last error: ${lastError!.message}`
  );
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Batch retry multiple operations in parallel
 *
 * @param operations - Array of async functions to execute
 * @param options - Retry configuration for each operation
 * @returns Promise resolving to array of results (or errors marked as failed)
 *
 * @example
 * ```ts
 * const fonts = [fontName1, fontName2, fontName3];
 * const results = await batchRetry(
 *   fonts.map(font => () => figma.loadFontAsync(font))
 * );
 * ```
 */
export async function batchRetry<T>(
  operations: (() => Promise<T>)[],
  options: RetryOptions = {}
): Promise<Array<T | { failed: true; error: string }>> {
  return Promise.all(
    operations.map(async (op) => {
      try {
        return await retryWithBackoff(op, options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { failed: true as const, error: message };
      }
    })
  );
}

/**
 * Check if a retry result failed
 *
 * @param result - Result from batchRetry
 * @returns True if the result is a failure
 */
export function isRetryFailure<T>(
  result: T | { failed: true; error: string }
): result is { failed: true; error: string } {
  return typeof result === 'object' && result !== null && 'failed' in result;
}

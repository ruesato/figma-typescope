/**
 * Virtualization Utilities for TanStack Virtual
 *
 * Wrapper and helpers for @tanstack/react-virtual to provide consistent API
 * and performance-optimized configurations for enterprise-scale rendering.
 *
 * Targets:
 * - Tree view with 1000+ styles: <500ms render time
 * - Detail panel with 10000+ layers: 60fps scrolling
 * - Memory usage: <400MB for 50k layers
 */

import type { Virtualizer } from '@tanstack/react-virtual';

// ============================================================================
// Virtualization Configuration
// ============================================================================

/**
 * Optimal overscan count for smooth scrolling
 * Higher values = more DOM nodes, smoother scrolling
 * Lower values = fewer DOM nodes, faster initial render
 */
export const OVERSCAN_COUNTS = {
  tree: 10, // For tree views - balance between smoothness and DOM size
  list: 15, // For lists - slightly higher for drag operations
  table: 20, // For tables - highest for complex layouts
};

/**
 * Estimated item sizes for different content types
 * TanStack Virtual uses these for scroll position calculation
 */
export const ITEM_SIZES = {
  treeNode: 32, // 32px height for tree nodes
  listItem: 48, // 48px height for list items
  tableRow: 40, // 40px height for table rows
  compact: 24, // 24px for compact/inline items
};

/**
 * Virtual scrolling range defaults
 */
export const VIRTUAL_SCROLL_DEFAULTS = {
  buffer: 10, // Number of items to render outside visible area
  dynamicItemSize: true, // Enable dynamic size calculation
  measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1,
};

// ============================================================================
// Performance Thresholds
// ============================================================================

/**
 * Enterprise Zone thresholds for performance optimization
 */
export const ENTERPRISE_ZONE_THRESHOLDS = {
  warningZone: 5000, // Warn above 5k items
  maxSize: 50000, // Hard limit at 50k items
  slowZone: 10000, // Significant slowdown expected above 10k
  progressUpdateFrequency: 50, // Emit progress every 50 items for large datasets
};

/**
 * Virtualization activation thresholds
 */
export const VIRTUALIZATION_THRESHOLDS = {
  tree: 100, // Virtualize tree if >100 nodes
  list: 500, // Virtualize list if >500 items
  table: 500, // Virtualize table if >500 rows
};

/**
 * Check if dataset requires virtualization
 */
export function requiresVirtualization(itemCount: number, type: 'tree' | 'list' | 'table'): boolean {
  return itemCount > VIRTUALIZATION_THRESHOLDS[type];
}

/**
 * Get recommended page size for batching large datasets
 */
export function getOptimalBatchSize(totalItems: number): number {
  if (totalItems < 1000) return 100;
  if (totalItems < 5000) return 100;
  if (totalItems < 25000) return 200;
  return 250; // Max 250 items per batch for 50k documents
}

/**
 * Calculate estimated render time for unvirtualized content
 * Used to determine if virtualization is necessary
 */
export function estimateRenderTime(itemCount: number, type: 'tree' | 'list' | 'table'): number {
  // Rough estimate: 0.5ms per item for tree, 0.3ms per item for list
  const msPerItem = type === 'tree' ? 0.5 : 0.3;
  return itemCount * msPerItem;
}

/**
 * Check if content should be virtualized based on estimated render time
 */
export function shouldVirtualize(itemCount: number, type: 'tree' | 'list' | 'table'): boolean {
  const estimatedTime = estimateRenderTime(itemCount, type);
  const targetRenderTime = 500; // 500ms target

  return estimatedTime > targetRenderTime || requiresVirtualization(itemCount, type);
}

// ============================================================================
// Virtualizer Configuration Helpers
// ============================================================================

/**
 * Get optimized virtualizer options for different content types
 */
export function getVirtualizerOptions(type: 'tree' | 'list' | 'table') {
  return {
    overscan: OVERSCAN_COUNTS[type],
    estimateSize: () => ITEM_SIZES[type],
    gap: 0,
  };
}

/**
 * Calculate safe scroll offset for smooth UX
 */
export function calculateSafeScrollOffset(virtualizer: Virtualizer<HTMLElement, Element>, targetIndex: number): number {
  try {
    return virtualizer.calculateOffset(targetIndex);
  } catch {
    // Fallback if calculation fails
    return targetIndex * ITEM_SIZES.listItem;
  }
}

/**
 * Smooth scroll to item within virtualized list
 */
export function smoothScrollToItem(virtualizer: Virtualizer<HTMLElement, Element>, index: number): void {
  try {
    virtualizer.scrollToIndex(index, { align: 'center', behavior: 'smooth' });
  } catch {
    console.warn('Failed to scroll to index:', index);
  }
}

// ============================================================================
// Memory Optimization
// ============================================================================

/**
 * Estimate memory footprint for virtualized content
 */
export function estimateMemoryUsage(itemCount: number, bytesPerItem: number = 500): number {
  // Each item in DOM takes ~500 bytes (metadata, properties, event listeners)
  const domMemory = itemCount * bytesPerItem;

  // Add overhead for React (reconciliation, hooks, etc.)
  const reactOverhead = domMemory * 0.3; // 30% overhead

  // Total in MB
  return (domMemory + reactOverhead) / (1024 * 1024);
}

/**
 * Get memory optimization recommendations
 */
export function getMemoryOptimization(itemCount: number): {
  level: 'low' | 'medium' | 'high';
  recommendation: string;
  maxVisibleItems: number;
} {
  const memoryUsage = estimateMemoryUsage(itemCount);

  if (itemCount < 5000) {
    return {
      level: 'low',
      recommendation: 'Memory usage should be minimal. No special optimization needed.',
      maxVisibleItems: itemCount,
    };
  }

  if (itemCount < 25000) {
    return {
      level: 'medium',
      recommendation: 'Use virtualization with 50-100 item overscan. Monitor memory.',
      maxVisibleItems: 100,
    };
  }

  return {
    level: 'high',
    recommendation: 'Use aggressive virtualization with 10-15 item overscan. Batch operations.',
    maxVisibleItems: 50,
  };
}

// ============================================================================
// Progressive Loading Helpers
// ============================================================================

/**
 * Generate batches for progressive loading
 */
export function generateBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Load batches progressively with idle callback
 */
export async function progressivelyLoadBatches<T>(
  batches: T[][],
  onBatchLoaded: (batch: T[], index: number) => void
): Promise<void> {
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    // Load first batch immediately
    if (i === 0) {
      onBatchLoaded(batch, i);
      continue;
    }

    // Load remaining batches in background
    await new Promise<void>((resolve) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          onBatchLoaded(batch, i);
          resolve();
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          onBatchLoaded(batch, i);
          resolve();
        }, 0);
      }
    });
  }
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Measure rendering performance
 */
export function measureRenderPerformance<T extends (...args: any[]) => any>(
  fn: T,
  label: string = 'Render'
): ReturnType<T> {
  const start = performance.now();
  const result = fn();
  const end = performance.now();

  const duration = end - start;
  const threshold = 500; // 500ms target

  if (duration > threshold) {
    console.warn(`${label} took ${duration.toFixed(2)}ms (target: ${threshold}ms)`);
  } else {
    console.log(`${label} took ${duration.toFixed(2)}ms`);
  }

  return result;
}

/**
 * Measure scroll performance
 */
export class ScrollPerformanceMonitor {
  private frameCount = 0;
  private lastSecond = performance.now();
  private fps = 60;

  measureFrame(): number {
    const now = performance.now();
    this.frameCount++;

    if (now - this.lastSecond >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastSecond = now;
    }

    return this.fps;
  }

  getFPS(): number {
    return this.fps;
  }

  isOptimal(): boolean {
    return this.fps >= 55; // 55fps or better is acceptable
  }
}

/**
 * Profile large dataset operations
 */
export async function profileOperation<T>(
  label: string,
  operation: () => Promise<T> | T
): Promise<{ result: T; duration: number; success: boolean }> {
  const start = performance.now();

  try {
    const result = await operation();
    const duration = performance.now() - start;

    console.log(`${label} completed in ${duration.toFixed(2)}ms`);

    return { result, duration, success: true };
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`${label} failed after ${duration.toFixed(2)}ms:`, error);

    return { result: null as any, duration, success: false };
  }
}

// ============================================================================
// Scroll Position Preservation
// ============================================================================

/**
 * Store and restore scroll position in virtualized lists
 */
export class ScrollPositionManager {
  private positions: Map<string, number> = new Map();

  savePosition(key: string, scrollOffset: number): void {
    this.positions.set(key, scrollOffset);
  }

  getPosition(key: string): number | undefined {
    return this.positions.get(key);
  }

  clear(): void {
    this.positions.clear();
  }
}

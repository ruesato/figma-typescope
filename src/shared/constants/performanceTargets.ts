/**
 * Performance Targets and Thresholds (P2 Enhancement)
 *
 * Centralized performance target definitions for enterprise-scale operations.
 * Enables easy tuning and consistent application across the codebase.
 *
 * Target Ranges:
 * - 5k layers: Warning zone (~1% of max capacity)
 * - 10k layers: Critical zone (2% of max)
 * - 25k layers: Heavy zone (50% of max capacity)
 * - 50k layers: Maximum supported (100% of max capacity)
 */

/**
 * Performance targets for enterprise-scale operations
 */
export const PERFORMANCE_TARGETS = {
  /** Rendering time targets by layer count (ms) */
  RENDER: {
    5000: 100,
    10000: 200,
    25000: 500,
    50000: 1000,
  } as const,

  /** Metrics calculation targets by layer count (ms) */
  METRICS: {
    5000: 100,
    10000: 200,
    25000: 500,
    50000: 1000,
  } as const,

  /** Memory usage targets by layer count (MB) */
  MEMORY: {
    5000: 100,
    10000: 200,
    25000: 400,
    50000: 400,
  } as const,

  /** FPS targets by layer count */
  FPS: {
    5000: 60,
    10000: 60,
    25000: 55,
    50000: 50,
  } as const,
} as const;

/**
 * Get performance target for a specific metric and layer count
 *
 * Uses nearest-match approach: finds the smallest threshold >= layerCount
 *
 * @param metric - Performance metric type (RENDER, METRICS, MEMORY, FPS)
 * @param layerCount - Number of layers to look up
 * @returns Target value for the metric at the given layer count
 *
 * @example
 * const renderTarget = getPerformanceTarget('RENDER', 7500); // 200ms (uses 10k threshold)
 * const fpsTarget = getPerformanceTarget('FPS', 50000); // 50fps (uses 50k threshold)
 */
export function getPerformanceTarget(
  metric: keyof typeof PERFORMANCE_TARGETS,
  layerCount: number
): number {
  const targets = PERFORMANCE_TARGETS[metric];

  // Find closest matching threshold (smallest threshold >= layerCount)
  const thresholds = (Object.keys(targets) as Array<keyof typeof targets>)
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b);

  const threshold = thresholds.find((t) => layerCount <= t) ?? thresholds[thresholds.length - 1]!;

  return targets[threshold as keyof typeof targets];
}

/**
 * Check if actual performance meets target
 *
 * @param actual - Actual measured value
 * @param metric - Performance metric type
 * @param layerCount - Number of layers
 * @returns true if actual <= target
 *
 * @example
 * const passed = isPerformanceAcceptable(95, 'METRICS', 5000); // true (95ms < 100ms target)
 */
export function isPerformanceAcceptable(
  actual: number,
  metric: keyof typeof PERFORMANCE_TARGETS,
  layerCount: number
): boolean {
  const target = getPerformanceTarget(metric, layerCount);
  return actual <= target;
}

/**
 * Get performance tier for a layer count
 *
 * Used for identifying which enterprise zone a document falls into
 *
 * @param layerCount - Number of layers
 * @returns Performance tier name
 *
 * @example
 * getPerformanceTier(5500); // 'warning-zone'
 * getPerformanceTier(12000); // 'critical-zone'
 */
export function getPerformanceTier(layerCount: number): 'normal' | 'warning-zone' | 'critical-zone' | 'heavy-zone' | 'max-capacity' {
  if (layerCount <= 5000) return 'normal';
  if (layerCount <= 10000) return 'warning-zone';
  if (layerCount <= 25000) return 'critical-zone';
  if (layerCount <= 50000) return 'heavy-zone';
  return 'max-capacity'; // Soft limit beyond 50k
}

/**
 * Performance tier descriptions and recommendations
 */
export const PERFORMANCE_TIER_INFO = {
  normal: {
    description: 'Optimal performance zone',
    recommendation: 'No special optimization needed',
    maxLayers: 5000,
  },
  'warning-zone': {
    description: 'Performance monitoring recommended',
    recommendation: 'Monitor FPS and memory usage during operations',
    maxLayers: 10000,
  },
  'critical-zone': {
    description: 'Performance optimization active',
    recommendation: 'Virtualization enabled, large batches recommended',
    maxLayers: 25000,
  },
  'heavy-zone': {
    description: 'Heavy load - expect slower operations',
    recommendation: 'Consider splitting into multiple documents',
    maxLayers: 50000,
  },
  'max-capacity': {
    description: 'Beyond maximum recommended capacity',
    recommendation: 'Split document - performance may be severely degraded',
    maxLayers: Infinity,
  },
} as const;

/**
 * Get recommendation for current layer count
 *
 * @param layerCount - Number of layers
 * @returns Recommendation for user
 *
 * @example
 * getPerformanceRecommendation(15000);
 * // "Heavy load - expect slower operations. Consider splitting into multiple documents."
 */
export function getPerformanceRecommendation(layerCount: number): string {
  const tier = getPerformanceTier(layerCount);
  const info = PERFORMANCE_TIER_INFO[tier];
  return `${info.description}. ${info.recommendation}`;
}

/**
 * Format performance metrics for display
 *
 * @param value - Metric value
 * @param metric - Metric type
 * @returns Formatted string with units
 *
 * @example
 * formatMetric(150, 'RENDER'); // "150ms"
 * formatMetric(250, 'MEMORY'); // "250MB"
 * formatMetric(58, 'FPS'); // "58fps"
 */
export function formatMetric(value: number, metric: keyof typeof PERFORMANCE_TARGETS): string {
  const units = {
    RENDER: 'ms',
    METRICS: 'ms',
    MEMORY: 'MB',
    FPS: 'fps',
  };
  return `${value}${units[metric]}`;
}

/**
 * Optimized Summary Calculations for Enterprise Scale
 *
 * Uses efficient data structures (Map, Set) instead of array iterations.
 * O(n) instead of O(n²) for large datasets (5k-50k layers).
 *
 * Performance targets:
 * - 5k layers: <100ms
 * - 10k layers: <200ms
 * - 25k layers: <500ms
 * - 50k layers: <1s
 */

import type { TextLayer, AuditMetrics, StyleGovernanceAuditResult } from '@/shared/types';

// ============================================================================
// Optimized Metrics Calculation
// ============================================================================

/**
 * Calculate audit metrics with O(n) complexity
 * Uses Maps for O(1) lookups instead of array.filter()
 */
export function calculateOptimizedMetrics(auditResult: Partial<StyleGovernanceAuditResult>): AuditMetrics {
  if (!auditResult.layers || auditResult.layers.length === 0) {
    console.warn('[calculateOptimizedMetrics] No layers found in audit result');
    return getEmptyMetrics();
  }

  const layers = auditResult.layers;
  const totalLayers = layers.length;

  console.log(`[calculateOptimizedMetrics] Processing ${totalLayers} layers`);

  // Debug: Check first layer structure
  if (layers.length > 0) {
    const firstLayer = layers[0];
    console.log('[calculateOptimizedMetrics] Sample layer:', {
      id: firstLayer.id,
      assignmentStatus: firstLayer.assignmentStatus,
      styleId: firstLayer.styleId,
      styleName: firstLayer.styleName,
      styleSource: firstLayer.styleSource,
      hasTokens: firstLayer.tokens?.length > 0,
      tokenCount: firstLayer.tokens?.length || 0,
    });
  }

  // Use Maps for efficient grouping - O(n) instead of O(n²)
  const libraryDistribution = new Map<string, number>();
  const styleUsageMap = new Map<string, { name: string; count: number }>();
  const tokensByCollection = new Map<string, number>();

  // Single pass through all layers - O(n)
  let fullyStyledCount = 0;
  let partiallyStyledCount = 0;
  let unstyledCount = 0;
  let tokenCoverageCount = 0;
  let fullTokenCoverageCount = 0;
  let partialTokenCoverageCount = 0;
  let noTokenCoverageCount = 0;
  let mixedUsageCount = 0;
  let elementsWithTokens = 0;
  let totalTokenBindings = 0;

  const topStylesSet = new Map<string, { id: string; name: string; count: number }>();

  for (const layer of layers) {
    // Style metrics
    if (layer.assignmentStatus === 'fully-styled') {
      fullyStyledCount++;
      if (layer.styleName) {
        styleUsageMap.set(layer.styleName, {
          name: layer.styleName,
          count: (styleUsageMap.get(layer.styleName)?.count ?? 0) + 1,
        });
        topStylesSet.set(layer.styleName, {
          id: layer.styleId || '',
          name: layer.styleName,
          count: (topStylesSet.get(layer.styleName)?.count ?? 0) + 1,
        });
      }
    } else if (layer.assignmentStatus === 'partially-styled') {
      partiallyStyledCount++;
    } else {
      unstyledCount++;
    }

    // Library distribution
    if (layer.styleSource) {
      libraryDistribution.set(layer.styleSource, (libraryDistribution.get(layer.styleSource) ?? 0) + 1);
    }

    // Token metrics
    if (layer.tokens && layer.tokens.length > 0) {
      elementsWithTokens++;
      totalTokenBindings += layer.tokens.length;

      // Count tokens by collection
      for (const token of layer.tokens) {
        // Extract collection from token (simplified - adjust based on actual structure)
        const collectionName = 'default'; // TODO: Extract from token metadata
        tokensByCollection.set(collectionName, (tokensByCollection.get(collectionName) ?? 0) + 1);
      }

      // Check coverage level
      const tokenCount = layer.tokens.length;
      if (tokenCount >= 5) {
        fullTokenCoverageCount++;
      } else if (tokenCount > 0) {
        partialTokenCoverageCount++;
      }
    } else {
      noTokenCoverageCount++;
    }

    // Mixed usage detection
    if (layer.assignmentStatus !== 'unstyled' && layer.tokens && layer.tokens.length > 0) {
      mixedUsageCount++;
    }
  }

  // Convert Maps to objects - O(m) where m = number of unique items
  const libraryDistributionObj: Record<string, number> = {};
  for (const [library, count] of libraryDistribution) {
    libraryDistributionObj[library] = count;
  }

  const tokensByCollectionObj: Record<string, number> = {};
  for (const [collection, count] of tokensByCollection) {
    tokensByCollectionObj[collection] = count;
  }

  // Get top 10 styles - O(m log m) where m = unique styles
  const topStyles = Array.from(topStylesSet.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate rates
  const styleAdoptionRate = totalLayers > 0 ? (fullyStyledCount / totalLayers) * 100 : 0;
  const tokenAdoptionRate = totalLayers > 0 ? (elementsWithTokens / totalLayers) * 100 : 0;
  const tokenCoverageRate = auditResult.tokens ? (auditResult.tokens.length / Math.max(totalTokenBindings, 1)) * 100 : 0;
  const fullTokenCoverageRate = totalLayers > 0 ? (fullTokenCoverageCount / totalLayers) * 100 : 0;
  const partialTokenCoverageRate = totalLayers > 0 ? (partialTokenCoverageCount / totalLayers) * 100 : 0;
  const noTokenCoverageRate = totalLayers > 0 ? (noTokenCoverageCount / totalLayers) * 100 : 0;

  // Debug: Log calculated metrics
  console.log('[calculateOptimizedMetrics] Calculated metrics:', {
    totalLayers,
    fullyStyledCount,
    partiallyStyledCount,
    unstyledCount,
    styleAdoptionRate: styleAdoptionRate.toFixed(1) + '%',
    elementsWithTokens,
    tokenAdoptionRate: tokenAdoptionRate.toFixed(1) + '%',
    totalTokenBindings,
    topStylesCount: topStyles.length,
    libraryCount: libraryDistribution.size,
  });

  return {
    styleAdoptionRate,
    fullyStyledCount,
    partiallyStyledCount,
    unstyledCount,
    libraryDistribution: libraryDistributionObj,
    tokenAdoptionRate,
    tokenCoverageRate,
    totalTokenCount: auditResult.tokens?.length ?? 0,
    uniqueTokensUsed: Math.min(totalTokenBindings, auditResult.tokens?.length ?? 0),
    unusedTokenCount: Math.max((auditResult.tokens?.length ?? 0) - totalTokenBindings, 0),
    totalTokenBindings,
    tokensByCollection: tokensByCollectionObj,
    elementCount: totalLayers,
    elementsWithTokens,
    elementsWithoutTokens: totalLayers - elementsWithTokens,
    fullTokenCoverageCount,
    fullTokenCoverageRate,
    partialTokenCoverageCount,
    partialTokenCoverageRate,
    noTokenCoverageCount,
    noTokenCoverageRate,
    tokenUsageCount: totalTokenBindings,
    mixedUsageCount,
    topStyles,
    deprecatedStyleCount: 0, // TODO: Implement if needed
  };
}

/**
 * Get empty metrics for zero-content results
 */
function getEmptyMetrics(): AuditMetrics {
  return {
    styleAdoptionRate: 0,
    fullyStyledCount: 0,
    partiallyStyledCount: 0,
    unstyledCount: 0,
    libraryDistribution: {},
    tokenAdoptionRate: 0,
    tokenCoverageRate: 0,
    totalTokenCount: 0,
    uniqueTokensUsed: 0,
    unusedTokenCount: 0,
    totalTokenBindings: 0,
    tokensByCollection: {},
    elementCount: 0,
    elementsWithTokens: 0,
    elementsWithoutTokens: 0,
    fullTokenCoverageCount: 0,
    fullTokenCoverageRate: 0,
    partialTokenCoverageCount: 0,
    partialTokenCoverageRate: 0,
    noTokenCoverageCount: 0,
    noTokenCoverageRate: 0,
    tokenUsageCount: 0,
    mixedUsageCount: 0,
    topStyles: [],
    deprecatedStyleCount: 0,
  };
}

// ============================================================================
// Optimized Grouping & Filtering
// ============================================================================

/**
 * Group layers by style with O(n) complexity
 * Returns Map for O(1) lookup
 */
export function groupLayersByStyle(layers: TextLayer[]): Map<string, TextLayer[]> {
  const groups = new Map<string, TextLayer[]>();

  for (const layer of layers) {
    const styleKey = layer.styleName || 'unstyled';
    const group = groups.get(styleKey) ?? [];
    group.push(layer);
    groups.set(styleKey, group);
  }

  return groups;
}

/**
 * Group layers by library with O(n) complexity
 */
export function groupLayersByLibrary(layers: TextLayer[]): Map<string, TextLayer[]> {
  const groups = new Map<string, TextLayer[]>();

  for (const layer of layers) {
    const libraryKey = layer.styleSource || 'unassigned';
    const group = groups.get(libraryKey) ?? [];
    group.push(layer);
    groups.set(libraryKey, group);
  }

  return groups;
}

/**
 * Group layers by page with O(n) complexity
 */
export function groupLayersByPage(layers: TextLayer[]): Map<string, TextLayer[]> {
  const groups = new Map<string, TextLayer[]>();

  for (const layer of layers) {
    const pageKey = layer.pageName || 'unknown';
    const group = groups.get(pageKey) ?? [];
    group.push(layer);
    groups.set(pageKey, group);
  }

  return groups;
}

/**
 * Filter layers with efficient predicate
 */
export function filterLayersEfficient(
  layers: TextLayer[],
  predicate: (layer: TextLayer) => boolean
): TextLayer[] {
  const result: TextLayer[] = [];
  for (const layer of layers) {
    if (predicate(layer)) {
      result.push(layer);
    }
  }
  return result;
}

// ============================================================================
// Performance Measurement
// ============================================================================

/**
 * Benchmark metrics calculation
 */
export function benchmarkMetricsCalculation(
  auditResult: Partial<StyleGovernanceAuditResult>
): { duration: number; metrics: AuditMetrics } {
  const start = performance.now();
  const metrics = calculateOptimizedMetrics(auditResult);
  const duration = performance.now() - start;

  return { duration, metrics };
}

/**
 * Get performance report for metrics calculation
 */
export function getMetricsPerformanceReport(layerCount: number, duration: number): {
  msPerThousandLayers: number;
  estimatedFor50k: number;
  isOptimal: boolean;
} {
  const msPerThousandLayers = (duration / layerCount) * 1000;
  const estimatedFor50k = msPerThousandLayers * 50;

  return {
    msPerThousandLayers,
    estimatedFor50k,
    isOptimal: duration < 500, // Should complete in <500ms for any size
  };
}

// ============================================================================
// Incremental Updates
// ============================================================================

/**
 * Update metrics incrementally when new layers are added
 * Faster than recalculating from scratch
 */
export function updateMetricsIncremental(
  currentMetrics: AuditMetrics,
  newLayers: TextLayer[],
  totalLayers: number
): AuditMetrics {
  // Recalculate is actually more efficient for small increments
  // This is kept for potential future optimization
  const updatedMetrics = { ...currentMetrics };
  const increment = newLayers.length;

  // Update counts
  for (const layer of newLayers) {
    if (layer.assignmentStatus === 'fully-styled') {
      updatedMetrics.fullyStyledCount++;
    } else if (layer.assignmentStatus === 'partially-styled') {
      updatedMetrics.partiallyStyledCount++;
    } else {
      updatedMetrics.unstyledCount++;
    }
  }

  // Recalculate rates
  updatedMetrics.styleAdoptionRate = (updatedMetrics.fullyStyledCount / totalLayers) * 100;

  return updatedMetrics;
}

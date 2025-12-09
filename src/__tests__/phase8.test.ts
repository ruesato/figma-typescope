/**
 * Phase 8 Performance Optimization - Unit Tests
 * Tests for core utilities: summary, batch loading, virtualization
 */

import { describe, it, expect, vi } from 'vitest';
import { calculateSummary, getAssignmentStatusBreakdown, getComponentTypeBreakdown } from '@/main/utils/summary';
import { getOptimalBatchSize, shouldVirtualize, estimateRenderTime } from '@/ui/utils/virtualization';
import type { TextLayerData } from '@/shared/types';

// ============================================================================
// Test Fixtures / Mock Data
// ============================================================================

const createMockLayer = (overrides?: Partial<TextLayerData>): TextLayerData => ({
  id: `layer-${Math.random()}`,
  name: 'Test Layer',
  fontFamily: 'Arial',
  fontSize: 12,
  fontWeight: 400,
  lineHeight: { value: 1.5, unit: 'AUTO' },
  letterSpacing: { value: 0, unit: 'PIXELS' },
  textContent: 'Test content',
  visible: true,
  styleAssignment: {
    assignmentStatus: 'fully-styled',
    styleName: 'Test Style',
    styleId: 'style-1',
    libraryName: 'Local',
  },
  componentContext: {
    componentType: 'plain',
    componentPath: undefined,
  },
  matchSuggestions: [],
  ...overrides,
});

// ============================================================================
// calculateSummary() Tests
// ============================================================================

describe('calculateSummary', () => {
  it('handles empty layer array', () => {
    const result = calculateSummary([]);
    expect(result.totalTextLayers).toBe(0);
    expect(result.uniqueFontFamilies).toBe(0);
    expect(result.styleCoveragePercent).toBe(0);
    expect(result.librariesInUse).toEqual([]);
  });

  it('calculates single layer correctly', () => {
    const layers = [createMockLayer()];
    const result = calculateSummary(layers);

    expect(result.totalTextLayers).toBe(1);
    expect(result.uniqueFontFamilies).toBe(1);
    expect(result.styleCoveragePercent).toBe(100); // fully-styled
    expect(result.librariesInUse).toContain('Local');
  });

  it('calculates multiple layers with mixed styles', () => {
    const layers = [
      createMockLayer({ styleAssignment: { ...createMockLayer().styleAssignment, assignmentStatus: 'fully-styled' } }),
      createMockLayer({ styleAssignment: { ...createMockLayer().styleAssignment, assignmentStatus: 'partially-styled' } }),
      createMockLayer({ styleAssignment: { ...createMockLayer().styleAssignment, assignmentStatus: 'unstyled' } }),
    ];

    const result = calculateSummary(layers);
    expect(result.totalTextLayers).toBe(3);
    expect(result.styleCoveragePercent).toBe(33); // 1 out of 3 fully-styled
  });

  it('counts hidden layers', () => {
    const layers = [
      createMockLayer({ visible: true }),
      createMockLayer({ visible: false }),
      createMockLayer({ visible: false }),
    ];

    const result = calculateSummary(layers);
    expect(result.hiddenLayersCount).toBe(2);
  });

  it('handles 5k layers efficiently', () => {
    const layers = Array.from({ length: 5000 }, (_, i) =>
      createMockLayer({
        id: `layer-${i}`,
        styleAssignment: {
          ...createMockLayer().styleAssignment,
          assignmentStatus: i % 3 === 0 ? 'unstyled' : 'fully-styled',
        },
      })
    );

    const start = performance.now();
    const result = calculateSummary(layers);
    const duration = performance.now() - start;

    expect(result.totalTextLayers).toBe(5000);
    expect(duration).toBeLessThan(100); // Target: <100ms for 5k
  });

  it('handles 50k layers efficiently', () => {
    const layers = Array.from({ length: 50000 }, (_, i) =>
      createMockLayer({
        id: `layer-${i}`,
        fontFamily: `Font-${i % 10}`,
      })
    );

    const start = performance.now();
    const result = calculateSummary(layers);
    const duration = performance.now() - start;

    expect(result.totalTextLayers).toBe(50000);
    expect(duration).toBeLessThan(1000); // Target: <1s for 50k
  });
});

// ============================================================================
// getAssignmentStatusBreakdown() Tests
// ============================================================================

describe('getAssignmentStatusBreakdown', () => {
  it('returns zeros for empty array', () => {
    const result = getAssignmentStatusBreakdown([]);
    expect(result).toEqual({ fullyStyled: 0, partiallyStyled: 0, unstyled: 0 });
  });

  it('counts each status correctly', () => {
    const layers = [
      createMockLayer({ styleAssignment: { ...createMockLayer().styleAssignment, assignmentStatus: 'fully-styled' } }),
      createMockLayer({ styleAssignment: { ...createMockLayer().styleAssignment, assignmentStatus: 'fully-styled' } }),
      createMockLayer({ styleAssignment: { ...createMockLayer().styleAssignment, assignmentStatus: 'partially-styled' } }),
      createMockLayer({ styleAssignment: { ...createMockLayer().styleAssignment, assignmentStatus: 'unstyled' } }),
    ];

    const result = getAssignmentStatusBreakdown(layers);
    expect(result.fullyStyled).toBe(2);
    expect(result.partiallyStyled).toBe(1);
    expect(result.unstyled).toBe(1);
  });

  it('handles large datasets efficiently', () => {
    const layers = Array.from({ length: 10000 }, (_, i) =>
      createMockLayer({
        id: `layer-${i}`,
        styleAssignment: {
          ...createMockLayer().styleAssignment,
          assignmentStatus: i % 3 === 0 ? 'unstyled' : i % 2 === 0 ? 'partially-styled' : 'fully-styled',
        },
      })
    );

    const start = performance.now();
    const result = getAssignmentStatusBreakdown(layers);
    const duration = performance.now() - start;

    expect(result.fullyStyled + result.partiallyStyled + result.unstyled).toBe(10000);
    expect(duration).toBeLessThan(50); // Should be very fast
  });
});

// ============================================================================
// getComponentTypeBreakdown() Tests
// ============================================================================

describe('getComponentTypeBreakdown', () => {
  it('returns zeros for empty array', () => {
    const result = getComponentTypeBreakdown([]);
    expect(result).toEqual({ mainComponent: 0, instance: 0, plain: 0 });
  });

  it('counts component types correctly', () => {
    const layers = [
      createMockLayer({ componentContext: { componentType: 'main-component', componentPath: undefined } }),
      createMockLayer({ componentContext: { componentType: 'instance', componentPath: 'Button' } }),
      createMockLayer({ componentContext: { componentType: 'plain', componentPath: undefined } }),
    ];

    const result = getComponentTypeBreakdown(layers);
    expect(result.mainComponent).toBe(1);
    expect(result.instance).toBe(1);
    expect(result.plain).toBe(1);
  });
});

// ============================================================================
// getOptimalBatchSize() Tests
// ============================================================================

describe('getOptimalBatchSize', () => {
  it('returns 100 for small datasets (<1000)', () => {
    expect(getOptimalBatchSize(100)).toBe(100);
    expect(getOptimalBatchSize(500)).toBe(100);
    expect(getOptimalBatchSize(999)).toBe(100);
  });

  it('returns 100 for medium datasets (1k-5k)', () => {
    expect(getOptimalBatchSize(1000)).toBe(100);
    expect(getOptimalBatchSize(2500)).toBe(100);
    expect(getOptimalBatchSize(4999)).toBe(100);
  });

  it('returns 200 for large datasets (5k-25k)', () => {
    expect(getOptimalBatchSize(5000)).toBe(200);
    expect(getOptimalBatchSize(10000)).toBe(200);
    expect(getOptimalBatchSize(24999)).toBe(200);
  });

  it('returns 250 for massive datasets (>25k)', () => {
    expect(getOptimalBatchSize(25001)).toBe(250);
    expect(getOptimalBatchSize(50000)).toBe(250);
  });

  it('handles boundary conditions correctly', () => {
    // Exact boundaries
    expect(getOptimalBatchSize(1000)).toBe(100);
    expect(getOptimalBatchSize(4999)).toBe(100);
    expect(getOptimalBatchSize(5000)).toBe(200);
    expect(getOptimalBatchSize(24999)).toBe(200);
    expect(getOptimalBatchSize(25000)).toBe(250);
  });
});

// ============================================================================
// shouldVirtualize() Tests
// ============================================================================

describe('shouldVirtualize', () => {
  it('returns false for small tree datasets', () => {
    expect(shouldVirtualize(50, 'tree')).toBe(false);
    expect(shouldVirtualize(99, 'tree')).toBe(false);
  });

  it('returns true for large tree datasets', () => {
    expect(shouldVirtualize(101, 'tree')).toBe(true);
    expect(shouldVirtualize(1000, 'tree')).toBe(true);
  });

  it('returns false for small list datasets', () => {
    expect(shouldVirtualize(100, 'list')).toBe(false);
    expect(shouldVirtualize(499, 'list')).toBe(false);
  });

  it('returns true for large list datasets', () => {
    expect(shouldVirtualize(501, 'list')).toBe(true);
    expect(shouldVirtualize(10000, 'list')).toBe(true);
  });

  it('returns false for small table datasets', () => {
    expect(shouldVirtualize(100, 'table')).toBe(false);
    expect(shouldVirtualize(499, 'table')).toBe(false);
  });

  it('returns true for large table datasets', () => {
    expect(shouldVirtualize(501, 'table')).toBe(true);
    expect(shouldVirtualize(50000, 'table')).toBe(true);
  });
});

// ============================================================================
// estimateRenderTime() Tests
// ============================================================================

describe('estimateRenderTime', () => {
  it('estimates tree render time at 0.5ms per item', () => {
    expect(estimateRenderTime(100, 'tree')).toBe(50); // 100 * 0.5
    expect(estimateRenderTime(1000, 'tree')).toBe(500);
  });

  it('estimates list render time at 0.3ms per item', () => {
    expect(estimateRenderTime(100, 'list')).toBe(30); // 100 * 0.3
    expect(estimateRenderTime(1000, 'list')).toBe(300);
  });

  it('estimates table render time at 0.3ms per item', () => {
    expect(estimateRenderTime(100, 'table')).toBe(30); // 100 * 0.3
  });

  it('returns higher estimates for trees than lists', () => {
    const itemCount = 1000;
    const treeTime = estimateRenderTime(itemCount, 'tree');
    const listTime = estimateRenderTime(itemCount, 'list');
    expect(treeTime).toBeGreaterThan(listTime);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Performance Optimization Integration', () => {
  it('processes 10k layers with summary + breakdown', () => {
    const layers = Array.from({ length: 10000 }, (_, i) =>
      createMockLayer({
        id: `layer-${i}`,
        styleAssignment: {
          ...createMockLayer().styleAssignment,
          assignmentStatus: i % 3 === 0 ? 'unstyled' : 'fully-styled',
        },
      })
    );

    const start = performance.now();

    const summary = calculateSummary(layers);
    const breakdown = getAssignmentStatusBreakdown(layers);

    const duration = performance.now() - start;

    expect(summary.totalTextLayers).toBe(10000);
    expect(breakdown.fullyStyled + breakdown.unstyled).toBe(10000);
    expect(duration).toBeLessThan(200); // Target: <200ms for 10k
  });

  it('batch size matches data characteristics', () => {
    expect(getOptimalBatchSize(5000)).toBe(200); // Medium batches for 5k
    expect(getOptimalBatchSize(25000)).toBe(250); // Larger batches for 25k
    expect(getOptimalBatchSize(50000)).toBe(250); // Larger batches for 50k

    // Verify batch counts make sense
    const batchCount5k = Math.ceil(5000 / 200); // 25 batches
    const batchCount50k = Math.ceil(50000 / 250); // 200 batches

    expect(batchCount5k).toBe(25);
    expect(batchCount50k).toBe(200);
  });
});

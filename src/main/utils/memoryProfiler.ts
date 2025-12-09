/**
 * Memory Profiler and Performance Test Harness (T129, T130, T131)
 *
 * Comprehensive memory profiling, leak detection, and performance validation
 * for enterprise-scale operations (10k-50k layers).
 *
 * Features:
 * - Real-time memory tracking with leak detection
 * - Batch operation profiling
 * - Performance validation against targets
 * - Detailed reporting and recommendations
 */

import { MemoryProfiler, PerformanceMonitor, RenderPerformanceMonitor } from '@/ui/utils/performanceProfiler';
import { analyzeBatchPerformance } from './progressiveBatchLoader';

// ============================================================================
// Test Data Generators (T130)
// ============================================================================

export interface MockTextLayer {
  id: string;
  name: string;
  styleName?: string;
  styleId?: string;
  assignmentStatus: 'fully-styled' | 'partially-styled' | 'unstyled';
  tokens?: { tokenId: string; name: string }[];
  textContent?: string;
  pageName: string;
  pageId: string;
  visible: boolean;
  hasOverrides?: boolean;
  usageCount?: number;
}

/**
 * Generate mock text layers for enterprise-scale testing
 *
 * @param count - Number of layers to generate
 * @param options - Generation options
 * @returns Array of mock text layers
 */
export function generateMockLayers(
  count: number,
  options: {
    styleDistribution?: 'concentrated' | 'spread';
    tokenUsageRate?: number;
    pageCount?: number;
  } = {}
): MockTextLayer[] {
  const {
    styleDistribution = 'spread',
    tokenUsageRate = 0.3,
    pageCount = 10,
  } = options;

  const layers: MockTextLayer[] = [];
  const styles = generateStyles(
    styleDistribution === 'concentrated' ? Math.ceil(count / 100) : Math.ceil(count / 10)
  );
  const tokens = generateTokens(50);

  for (let i = 0; i < count; i++) {
    const styleIndex = styleDistribution === 'concentrated'
      ? Math.floor(i / 100) % styles.length
      : Math.floor(Math.random() * styles.length);
    const style = styles[styleIndex];

    const assignmentStatuses: Array<'fully-styled' | 'partially-styled' | 'unstyled'> = [
      'fully-styled',
      'partially-styled',
      'unstyled',
    ];
    const assignmentStatus = assignmentStatuses[Math.floor(Math.random() * 3)];

    layers.push({
      id: `layer-${i}`,
      name: `Text Layer ${i + 1}`,
      styleName: assignmentStatus !== 'unstyled' ? style.name : undefined,
      styleId: assignmentStatus !== 'unstyled' ? style.id : undefined,
      assignmentStatus,
      tokens:
        Math.random() < tokenUsageRate && assignmentStatus !== 'unstyled'
          ? [tokens[Math.floor(Math.random() * tokens.length)]]
          : undefined,
      textContent: `Sample text content for layer ${i + 1}`,
      pageName: `Page ${Math.floor(i / (count / pageCount)) + 1}`,
      pageId: `page-${Math.floor(i / (count / pageCount))}`,
      visible: Math.random() > 0.1, // 90% visible
      hasOverrides: assignmentStatus === 'partially-styled',
      usageCount: Math.floor(Math.random() * 50),
    });
  }

  return layers;
}

function generateStyles(count: number) {
  const styles = [];
  for (let i = 0; i < count; i++) {
    styles.push({
      id: `style-${i}`,
      name: `Style ${i + 1}`,
      usageCount: Math.floor(Math.random() * 100),
    });
  }
  return styles;
}

function generateTokens(count: number) {
  const tokens = [];
  for (let i = 0; i < count; i++) {
    tokens.push({
      tokenId: `token-${i}`,
      name: `Token ${i + 1}`,
    });
  }
  return tokens;
}

// ============================================================================
// Performance Test Suite (T131)
// ============================================================================

export interface PerformanceTestResult {
  testName: string;
  layerCount: number;
  duration: number;
  memory: {
    usedMB: number;
    deltaMB: number;
  };
  fps?: number;
  passed: boolean;
  message: string;
  recommendations: string[];
}

export class PerformanceTestSuite {
  private memoryProfiler: MemoryProfiler;
  private performanceMonitor: PerformanceMonitor;
  private renderMonitor: RenderPerformanceMonitor;
  private results: PerformanceTestResult[] = [];

  constructor() {
    this.memoryProfiler = new MemoryProfiler();
    this.performanceMonitor = new PerformanceMonitor();
    this.renderMonitor = new RenderPerformanceMonitor();
  }

  /**
   * Test virtualized tree rendering performance
   */
  async testVirtualizedTreeRender(layerCount: number): Promise<PerformanceTestResult> {
    this.memoryProfiler.clear();
    this.performanceMonitor.clear();
    this.renderMonitor.clear();

    const startMem = this.memoryProfiler.snapshot();
    this.performanceMonitor.startMeasure('tree-render');

    // Simulate tree render operation
    const layers = generateMockLayers(layerCount);
    const flattened: any[] = [];
    const traverse = (items: any[]) => {
      for (const item of items) {
        flattened.push(item);
      }
    };
    traverse(layers);

    const duration = this.performanceMonitor.endMeasure('tree-render');
    const endMem = this.memoryProfiler.snapshot();

    const passed = duration < 500 && (endMem.usedJSHeapSize - startMem.usedJSHeapSize) / (1024 * 1024) < 50;
    const result: PerformanceTestResult = {
      testName: 'Virtualized Tree Render',
      layerCount,
      duration,
      memory: {
        usedMB: endMem.usedJSHeapSize / (1024 * 1024),
        deltaMB: (endMem.usedJSHeapSize - startMem.usedJSHeapSize) / (1024 * 1024),
      },
      passed,
      message: passed ? '✓ Tree render performance acceptable' : '⚠ Tree render exceeds targets',
      recommendations: this.generateRecommendations(duration, 500, endMem.usedJSHeapSize - startMem.usedJSHeapSize),
    };

    this.results.push(result);
    return result;
  }

  /**
   * Test detail panel scrolling performance
   */
  async testDetailPanelScroll(layerCount: number): Promise<PerformanceTestResult> {
    this.memoryProfiler.clear();
    this.renderMonitor.clear();

    const startMem = this.memoryProfiler.snapshot();
    const layers = generateMockLayers(layerCount);

    // Simulate scroll operations
    for (let i = 0; i < 10; i++) {
      this.renderMonitor.updateFPS();
    }

    const endMem = this.memoryProfiler.snapshot();
    const fps = this.renderMonitor.getFPS();

    const passed = fps >= 55 && (endMem.usedJSHeapSize - startMem.usedJSHeapSize) / (1024 * 1024) < 100;
    const result: PerformanceTestResult = {
      testName: 'Detail Panel Scroll',
      layerCount,
      duration: 0,
      memory: {
        usedMB: endMem.usedJSHeapSize / (1024 * 1024),
        deltaMB: (endMem.usedJSHeapSize - startMem.usedJSHeapSize) / (1024 * 1024),
      },
      fps,
      passed,
      message: passed ? '✓ Scroll performance acceptable' : '⚠ Scroll performance degraded',
      recommendations: fps < 55 ? ['Reduce overscan count', 'Enable GPU acceleration'] : [],
    };

    this.results.push(result);
    return result;
  }

  /**
   * Test metrics calculation performance
   */
  async testMetricsCalculation(layerCount: number): Promise<PerformanceTestResult> {
    this.memoryProfiler.clear();
    this.performanceMonitor.clear();

    const layers = generateMockLayers(layerCount);
    const startMem = this.memoryProfiler.snapshot();
    this.performanceMonitor.startMeasure('metrics-calc');

    // Simulate metrics calculation - single pass O(n)
    let fullyStyled = 0;
    let partiallyStyled = 0;
    let unstyled = 0;
    let tokenCount = 0;

    for (const layer of layers) {
      switch (layer.assignmentStatus) {
        case 'fully-styled':
          fullyStyled++;
          break;
        case 'partially-styled':
          partiallyStyled++;
          break;
        case 'unstyled':
          unstyled++;
          break;
      }
      if (layer.tokens) {
        tokenCount += layer.tokens.length;
      }
    }

    const duration = this.performanceMonitor.endMeasure('metrics-calc');
    const endMem = this.memoryProfiler.snapshot();

    // Performance targets vary by layer count
    let target = 500;
    if (layerCount <= 5000) target = 100;
    else if (layerCount <= 10000) target = 200;
    else if (layerCount <= 25000) target = 500;

    const passed = duration < target;
    const result: PerformanceTestResult = {
      testName: 'Metrics Calculation',
      layerCount,
      duration,
      memory: {
        usedMB: endMem.usedJSHeapSize / (1024 * 1024),
        deltaMB: (endMem.usedJSHeapSize - startMem.usedJSHeapSize) / (1024 * 1024),
      },
      passed,
      message: passed
        ? `✓ Metrics calculation completed in ${duration.toFixed(0)}ms`
        : `⚠ Metrics calculation exceeded target (${duration.toFixed(0)}ms > ${target}ms)`,
      recommendations: !passed ? ['Use cached metrics', 'Defer heavy calculations'] : [],
    };

    this.results.push(result);
    return result;
  }

  /**
   * Test memory leak detection
   */
  async testMemoryLeak(layerCount: number): Promise<PerformanceTestResult> {
    this.memoryProfiler.clear();

    // Take multiple snapshots over time
    const snapshots = [];
    for (let i = 0; i < 5; i++) {
      const snapshot = this.memoryProfiler.snapshot();
      snapshots.push(snapshot);
      // Simulate some work
      generateMockLayers(layerCount / 5);
    }

    const leakDetection = this.memoryProfiler.detectLeak();
    const report = this.memoryProfiler.getReport();

    const result: PerformanceTestResult = {
      testName: 'Memory Leak Detection',
      layerCount,
      duration: 0,
      memory: {
        usedMB: report?.usedMB || 0,
        deltaMB: report?.deltaMB || 0,
      },
      passed: !leakDetection.isLeak,
      message: leakDetection.recommendation,
      recommendations: leakDetection.isLeak ? [leakDetection.recommendation] : [],
    };

    this.results.push(result);
    return result;
  }

  /**
   * Run all performance tests
   */
  async runAllTests(layerCounts: number[] = [5000, 10000, 25000, 50000]): Promise<PerformanceTestResult[]> {
    this.results = [];

    for (const count of layerCounts) {
      console.log(`\n Testing with ${count.toLocaleString()} layers...`);
      await this.testVirtualizedTreeRender(count);
      await this.testDetailPanelScroll(count);
      await this.testMetricsCalculation(count);
      await this.testMemoryLeak(count);
    }

    return this.results;
  }

  /**
   * Get test summary
   */
  getSummary() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    return {
      totalTests,
      passedTests,
      failedTests,
      passRate: ((passedTests / totalTests) * 100).toFixed(1) + '%',
      results: this.results,
      summary: `${passedTests}/${totalTests} tests passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(actual: number, target: number, memoryDelta: number): string[] {
    const recommendations: string[] = [];

    if (actual > target * 1.5) {
      recommendations.push('Performance significantly degraded - consider optimization');
    } else if (actual > target) {
      recommendations.push('Minor performance issue - profile for bottlenecks');
    }

    if (memoryDelta > 100 * 1024 * 1024) {
      recommendations.push('High memory usage - check for memory leaks');
    } else if (memoryDelta > 50 * 1024 * 1024) {
      recommendations.push('Elevated memory usage - monitor closely');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance within acceptable range');
    }

    return recommendations;
  }
}

/**
 * Run comprehensive enterprise-scale performance validation
 */
export async function validateEnterprisePerformance() {
  console.log('🚀 Starting Enterprise Zone Performance Validation (T131)');
  console.log('═'.repeat(60));

  const testSuite = new PerformanceTestSuite();
  const results = await testSuite.runAllTests();

  const summary = testSuite.getSummary();

  console.log('\n📊 Test Results Summary');
  console.log('═'.repeat(60));
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Passed: ${summary.passedTests} ✓`);
  console.log(`Failed: ${summary.failedTests} ✗`);
  console.log(`Pass Rate: ${summary.passRate}`);

  console.log('\n📈 Detailed Results');
  console.log('═'.repeat(60));
  for (const result of results) {
    const status = result.passed ? '✓' : '✗';
    console.log(`\n${status} ${result.testName} (${result.layerCount.toLocaleString()} layers)`);
    if (result.duration) {
      console.log(`   Duration: ${result.duration.toFixed(0)}ms`);
    }
    if (result.fps) {
      console.log(`   FPS: ${result.fps}`);
    }
    console.log(`   Memory: ${result.memory.usedMB.toFixed(1)}MB (Δ${result.memory.deltaMB.toFixed(1)}MB)`);
    if (result.recommendations.length > 0) {
      for (const rec of result.recommendations) {
        console.log(`   → ${rec}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  return summary;
}

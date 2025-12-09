/**
 * Performance Profiler (T129)
 *
 * Comprehensive performance monitoring and profiling for enterprise-scale operations.
 * Identifies memory leaks, bottlenecks, and provides actionable optimization recommendations.
 */

// ============================================================================
// Memory Profiler
// ============================================================================

/**
 * Track memory usage over time
 */
export class MemoryProfiler {
  private snapshots: Array<{
    timestamp: number;
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    delta: number;
  }> = [];

  /**
   * Take a memory snapshot
   */
  snapshot(): { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } {
    if (!performance.memory) {
      return { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
    }

    const current = {
      timestamp: performance.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      delta: 0,
    };

    if (this.snapshots.length > 0) {
      const previous = this.snapshots[this.snapshots.length - 1];
      current.delta = current.usedJSHeapSize - previous.usedJSHeapSize;
    }

    this.snapshots.push(current);
    return current;
  }

  /**
   * Get memory report
   */
  getReport() {
    if (this.snapshots.length === 0) {
      return null;
    }

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];

    const usedMB = last.usedJSHeapSize / (1024 * 1024);
    const totalMB = last.totalJSHeapSize / (1024 * 1024);
    const limitMB = last.jsHeapSizeLimit / (1024 * 1024);
    const deltaMB = (last.usedJSHeapSize - first.usedJSHeapSize) / (1024 * 1024);

    return {
      usedMB: parseFloat(usedMB.toFixed(2)),
      totalMB: parseFloat(totalMB.toFixed(2)),
      limitMB: parseFloat(limitMB.toFixed(2)),
      deltaMB: parseFloat(deltaMB.toFixed(2)),
      utilizationPercent: ((usedMB / limitMB) * 100).toFixed(1),
      snapshotCount: this.snapshots.length,
    };
  }

  /**
   * Clear snapshots
   */
  clear(): void {
    this.snapshots = [];
  }

  /**
   * Detect memory leak
   */
  detectLeak(): { isLeak: boolean; recommendation: string } {
    if (this.snapshots.length < 3) {
      return { isLeak: false, recommendation: 'Need at least 3 snapshots for leak detection' };
    }

    const deltas = this.snapshots.map((s) => s.delta);
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

    // If average delta is consistently positive and large, likely a leak
    const isLeak = avgDelta > 1000000 && deltas.filter((d) => d > 0).length >= deltas.length * 0.8;

    return {
      isLeak,
      recommendation: isLeak
        ? 'Memory leak detected. Check for: 1) Event listeners not removed, 2) Circular references, 3) Cached objects not cleared'
        : 'No obvious memory leak detected',
    };
  }
}

// ============================================================================
// Performance Monitor
// ============================================================================

/**
 * Monitor performance metrics
 */
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measurements: Map<string, Array<{ duration: number; timestamp: number }>> = new Map();

  /**
   * Start measuring operation
   */
  startMeasure(label: string): void {
    this.marks.set(label, performance.now());
  }

  /**
   * End measuring operation
   */
  endMeasure(label: string): number {
    const startTime = this.marks.get(label);
    if (!startTime) {
      console.warn(`No mark found for ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    const measurements = this.measurements.get(label) || [];
    measurements.push({ duration, timestamp: Date.now() });
    this.measurements.set(label, measurements);

    this.marks.delete(label);
    return duration;
  }

  /**
   * Get statistics for a measurement
   */
  getStats(label: string) {
    const measurements = this.measurements.get(label);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const durations = measurements.map((m) => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return {
      count: measurements.length,
      avgMs: parseFloat(avg.toFixed(2)),
      minMs: parseFloat(min.toFixed(2)),
      maxMs: parseFloat(max.toFixed(2)),
      totalMs: parseFloat(sum.toFixed(2)),
    };
  }

  /**
   * Get all measurements report
   */
  getReport() {
    const report: Record<string, any> = {};

    for (const [label, _] of this.measurements) {
      report[label] = this.getStats(label);
    }

    return report;
  }

  /**
   * Clear measurements
   */
  clear(): void {
    this.marks.clear();
    this.measurements.clear();
  }
}

// ============================================================================
// Render Performance Monitor
// ============================================================================

/**
 * Monitor React rendering performance
 */
export class RenderPerformanceMonitor {
  private renderTimes: number[] = [];
  private fps: number = 60;
  private lastFrameTime: number = performance.now();
  private frameCount: number = 0;

  /**
   * Measure a render operation
   */
  measureRender<T>(fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.renderTimes.push(duration);
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }

    return { result, duration };
  }

  /**
   * Update FPS counter
   */
  updateFPS(): void {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;

    if (deltaTime > 0) {
      this.fps = 1000 / deltaTime;
    }

    this.lastFrameTime = now;
    this.frameCount++;
  }

  /**
   * Get FPS
   */
  getFPS(): number {
    return Math.round(this.fps);
  }

  /**
   * Get average render time
   */
  getAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    const sum = this.renderTimes.reduce((a, b) => a + b, 0);
    return sum / this.renderTimes.length;
  }

  /**
   * Check if performance is optimal
   */
  isOptimal(): boolean {
    return this.getFPS() >= 55 && this.getAverageRenderTime() < 50; // 60fps, <50ms renders
  }

  /**
   * Get performance report
   */
  getReport() {
    return {
      fps: this.getFPS(),
      avgRenderTimeMs: parseFloat(this.getAverageRenderTime().toFixed(2)),
      renderCount: this.renderTimes.length,
      isOptimal: this.isOptimal(),
      recommendation: this.isOptimal()
        ? 'Performance is optimal'
        : `Performance degraded: ${this.getFPS()}fps, ${this.getAverageRenderTime().toFixed(0)}ms avg render`,
    };
  }

  /**
   * Clear measurements
   */
  clear(): void {
    this.renderTimes = [];
    this.frameCount = 0;
  }
}

// ============================================================================
// Comprehensive Performance Audit
// ============================================================================

/**
 * Run comprehensive performance audit
 */
export async function auditPerformance(
  operation: () => Promise<void>,
  label: string = 'Operation'
): Promise<{
  duration: number;
  memory: any;
  recommendation: string;
}> {
  const monitor = new PerformanceMonitor();
  const memoryProfiler = new MemoryProfiler();

  // Start measurements
  monitor.startMeasure(label);
  const memStart = memoryProfiler.snapshot();

  try {
    // Run operation
    await operation();

    // End measurements
    const duration = monitor.endMeasure(label);
    const memEnd = memoryProfiler.snapshot();

    // Generate recommendation
    let recommendation = '✓ Operation completed successfully';

    if (duration > 5000) {
      recommendation = `⚠️ Operation took ${(duration / 1000).toFixed(1)}s. Consider optimization.`;
    }

    const memoryDelta = (memEnd.usedJSHeapSize - memStart.usedJSHeapSize) / (1024 * 1024);
    if (memoryDelta > 50) {
      recommendation += ` Memory increased by ${memoryDelta.toFixed(1)}MB.`;
    }

    return {
      duration,
      memory: memoryProfiler.getReport(),
      recommendation,
    };
  } catch (error) {
    return {
      duration: monitor.endMeasure(label),
      memory: memoryProfiler.getReport(),
      recommendation: `❌ Operation failed: ${error}`,
    };
  }
}

// ============================================================================
// Performance Thresholds & Recommendations
// ============================================================================

/**
 * Get performance recommendations based on metrics
 */
export function getPerformanceRecommendations(metrics: {
  duration: number;
  fps: number;
  memoryMB: number;
  itemCount: number;
}): string[] {
  const recommendations: string[] = [];

  // Check duration
  if (metrics.duration > 1000) {
    recommendations.push('🐌 Rendering is slow. Consider virtualization or batch loading.');
  }

  // Check FPS
  if (metrics.fps < 30) {
    recommendations.push('📉 FPS is very low. Check for CPU-intensive operations.');
  } else if (metrics.fps < 55) {
    recommendations.push('⚠️  FPS is below target (60). Minor optimizations needed.');
  }

  // Check memory
  if (metrics.memoryMB > 400) {
    recommendations.push('💾 Memory usage is high. Check for memory leaks.');
  } else if (metrics.memoryMB > 300) {
    recommendations.push('⚠️  Memory usage is elevated. Monitor for leaks.');
  }

  // Check item density
  if (metrics.itemCount > 5000) {
    recommendations.push('📊 Large dataset detected. Virtualization is recommended.');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Performance looks good!');
  }

  return recommendations;
}

// ============================================================================
// Real-time Performance Indicator
// ============================================================================

/**
 * Real-time performance indicator
 */
export class PerformanceIndicator {
  private fps: number = 60;
  private lastUpdate: number = performance.now();
  private animationFrameId: number | null = null;

  /**
   * Start monitoring
   */
  start(onUpdate?: (fps: number) => void): void {
    const update = () => {
      const now = performance.now();
      const deltaTime = now - this.lastUpdate;

      if (deltaTime > 0) {
        this.fps = 1000 / deltaTime;
      }

      this.lastUpdate = now;
      onUpdate?.(Math.round(this.fps));

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return Math.round(this.fps);
  }

  /**
   * Get health status
   */
  getStatus(): 'excellent' | 'good' | 'fair' | 'poor' {
    const fps = this.getFPS();
    if (fps >= 55) return 'excellent';
    if (fps >= 45) return 'good';
    if (fps >= 30) return 'fair';
    return 'poor';
  }
}

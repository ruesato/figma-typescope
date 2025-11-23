import type { ReplacementResult, FailedLayer } from '@/shared/types';
import { BatchProcessor } from './batchProcessor';
import { retryWithBackoff, classifyError } from './errorRecovery';

/**
 * Replacement Engine for Style Governance
 *
 * Handles bulk style and token replacement with safety guarantees:
 * - Version history checkpoints before changes
 * - Adaptive batch processing (100→25→100 on errors)
 * - Error recovery with exponential backoff
 * - Rollback support via version history
 *
 * State Machine: idle → validating → creating_checkpoint → processing → complete/error
 * No cancellation after checkpoint (safety constraint)
 */

// ============================================================================
// Types
// ============================================================================

export type ReplacementState =
  | 'idle'
  | 'validating'
  | 'creating_checkpoint'
  | 'processing'
  | 'complete'
  | 'error';

export interface StyleReplacementOptions {
  sourceStyleId: string;
  targetStyleId: string;
  affectedLayerIds: string[];
  preserveOverrides?: boolean;
  skipComponentInstances?: boolean;
  progressCallback?: ReplacementProgressCallback;
}

export interface TokenReplacementOptions {
  sourceTokenId: string;
  targetTokenId: string;
  affectedLayerIds: string[];
  propertyTypes?: string[];
  progressCallback?: ReplacementProgressCallback;
}

export interface ReplacementProgress {
  state: ReplacementState;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  currentBatchSize: number;
  layersProcessed: number;
  failedLayers: number;
  checkpointTitle?: string;
}

export type ReplacementProgressCallback = (progress: ReplacementProgress) => void;
export type ReplacementStateChangeCallback = (
  oldState: ReplacementState,
  newState: ReplacementState
) => void;

// ============================================================================
// Replacement Engine
// ============================================================================

export class ReplacementEngine {
  private state: ReplacementState = 'idle';
  private progressCallbacks: ReplacementProgressCallback[] = [];
  private stateChangeCallbacks: ReplacementStateChangeCallback[] = [];
  private checkpointTitle?: string;

  /**
   * Get current state
   */
  getState(): ReplacementState {
    return this.state;
  }

  /**
   * Check if replacement can be cancelled
   * Always returns false after checkpoint created (safety constraint)
   */
  canCancelReplacement(): boolean {
    return this.state === 'idle' || this.state === 'validating';
  }

  /**
   * Register progress callback
   */
  onProgress(callback: ReplacementProgressCallback): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Process style replacement with adaptive batching and error recovery
   */
  private async processStyleReplacement(
    options: StyleReplacementOptions
  ): Promise<Omit<ReplacementResult, 'checkpointTitle' | 'duration'>> {
    const { affectedLayerIds, targetStyleId } = options;

    let layersUpdated = 0;
    let layersFailed = 0;
    const failedLayers: FailedLayer[] = [];

    const totalLayers = affectedLayerIds.length;

    // Create batch processor with adaptive sizing
    const batchProcessor = new BatchProcessor({
      initialBatchSize: 100,
      minBatchSize: 25,
      maxBatchSize: 100,
      successThreshold: 5,
      onBatchComplete: (result) => {
        // Update counts
        layersUpdated += result.layersProcessed;
        layersFailed += result.layersFailed;

        // Collect failed layers
        for (const error of result.errors) {
          failedLayers.push({
            layerId: error.layerId,
            layerName: error.layerName,
            reason: error.error.message,
            retryCount: error.retryCount,
          });
        }

        // Emit progress
        const totalProcessed = layersUpdated + layersFailed;
        const percentage = Math.round((totalProcessed / totalLayers) * 90) + 10; // 10-100%

        this.emitProgress({
          state: 'processing',
          percentage,
          currentBatch: result.batchNumber,
          totalBatches: Math.ceil(totalLayers / batchProcessor.getCurrentBatchSize()),
          currentBatchSize: result.batchSize,
          layersProcessed: totalProcessed,
          failedLayers: layersFailed,
          checkpointTitle: this.checkpointTitle,
        });
      },
    });

    console.log(`Processing ${totalLayers} layers with adaptive batching`);

    // Process layers with adaptive batching
    for await (const _batchResult of batchProcessor.processBatches(
      affectedLayerIds,
      async (layerId) => {
        // Apply style replacement with retry logic
        await retryWithBackoff(async () => {
          const node = await figma.getNodeByIdAsync(layerId);

          if (!node || node.type !== 'TEXT') {
            throw new Error('Not a text layer');
          }

          // Apply new style
          (node as TextNode).textStyleId = targetStyleId;
        });
      }
    )) {
      // Batch processed - progress emitted via callback
    }

    console.log(`Replacement complete: ${layersUpdated} updated, ${layersFailed} failed`);

    return {
      success: layersFailed === 0,
      layersUpdated,
      layersFailed,
      failedLayers,
      hasWarnings: layersFailed > 0,
    };
  }

  /**
   * Replace style across affected layers
   */
  async replaceStyle(options: StyleReplacementOptions): Promise<ReplacementResult> {
    const startTime = Date.now();

    try {
      // Step 1: Validation
      await this.transitionState('validating');
      await this.validateStyleReplacement(options);

      // Step 2: Create checkpoint
      await this.transitionState('creating_checkpoint');
      this.checkpointTitle = await this.createCheckpoint('Style Replacement');
      this.emitProgress({
        state: 'creating_checkpoint',
        percentage: 10,
        currentBatch: 0,
        totalBatches: 0,
        currentBatchSize: 0,
        layersProcessed: 0,
        failedLayers: 0,
        checkpointTitle: this.checkpointTitle,
      });

      // Step 3: Processing
      await this.transitionState('processing');
      const result = await this.processStyleReplacement(options);

      // Step 4: Complete
      await this.transitionState('complete');

      return {
        ...result,
        checkpointTitle: this.checkpointTitle,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await this.transitionState('error');
      throw error;
    }
  }

  /**
   * Replace token across affected layers
   */
  async replaceToken(options: TokenReplacementOptions): Promise<ReplacementResult> {
    const startTime = Date.now();

    try {
      // Step 1: Validation
      await this.transitionState('validating');
      await this.validateTokenReplacement(options);

      // Step 2: Create checkpoint
      await this.transitionState('creating_checkpoint');
      this.checkpointTitle = await this.createCheckpoint('Token Replacement');
      this.emitProgress({
        state: 'creating_checkpoint',
        percentage: 10,
        currentBatch: 0,
        totalBatches: 0,
        currentBatchSize: 0,
        layersProcessed: 0,
        failedLayers: 0,
        checkpointTitle: this.checkpointTitle,
      });

      // Step 3: Processing
      await this.transitionState('processing');
      const result = await this.processTokenReplacement(options);

      // Step 4: Complete
      await this.transitionState('complete');

      return {
        ...result,
        checkpointTitle: this.checkpointTitle,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      await this.transitionState('error');
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.progressCallbacks = [];
    this.stateChangeCallbacks = [];
    this.state = 'idle';
    this.checkpointTitle = undefined;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Transition to new state and notify callbacks
   */
  private async transitionState(newState: ReplacementState): Promise<void> {
    const oldState = this.state;
    this.state = newState;

    // Notify state change callbacks
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(oldState, newState);
      } catch (error) {
        console.warn('State change callback error:', error);
      }
    }
  }

  /**
   * Emit progress update to callbacks
   */
  private emitProgress(progress: ReplacementProgress): void {
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Progress callback error:', error);
      }
    }
  }

  /**
   * Validate style replacement options
   */
  private async validateStyleReplacement(options: StyleReplacementOptions): Promise<void> {
    // Check source and target are different
    if (options.sourceStyleId === options.targetStyleId) {
      throw new Error('Source and target styles cannot be the same');
    }

    // Verify source style exists
    const sourceStyle = await figma.getStyleByIdAsync(options.sourceStyleId);
    if (!sourceStyle || sourceStyle.type !== 'TEXT') {
      throw new Error('Source style not found');
    }

    // Verify target style exists
    const targetStyle = await figma.getStyleByIdAsync(options.targetStyleId);
    if (!targetStyle || targetStyle.type !== 'TEXT') {
      throw new Error('Target style not found');
    }

    // Check affected layers
    if (!options.affectedLayerIds || options.affectedLayerIds.length === 0) {
      throw new Error('No layers specified for replacement');
    }
  }

  /**
   * Validate token replacement options
   */
  private async validateTokenReplacement(options: TokenReplacementOptions): Promise<void> {
    // Check source and target are different
    if (options.sourceTokenId === options.targetTokenId) {
      throw new Error('Source and target tokens cannot be the same');
    }

    // Check affected layers
    if (!options.affectedLayerIds || options.affectedLayerIds.length === 0) {
      throw new Error('No layers specified for replacement');
    }

    // TODO: Validate tokens exist (requires Variables API)
  }

  /**
   * Create version history checkpoint
   */
  private async createCheckpoint(operationName: string): Promise<string> {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const title = `${operationName} - ${timestamp}`;

    try {
      await figma.saveVersionHistoryAsync(title);
      console.log(`Created version checkpoint: ${title}`);
      return title;
    } catch (error) {
      console.error('Failed to create version checkpoint:', error);
      throw new Error(`Checkpoint creation failed: ${error}`);
    }
  }


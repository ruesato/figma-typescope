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
  private cancelRequested: boolean = false;

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
   * Request cancellation of the current replacement operation
   * Sets a flag that will be checked during processing
   */
  cancel(): void {
    this.cancelRequested = true;
  }

  /**
   * Check if cancellation has been requested
   */
  isCancelled(): boolean {
    return this.cancelRequested;
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
        // Check for cancellation before processing each layer
        if (this.cancelRequested) {
          throw new Error('Replacement cancelled by user');
        }

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
   * Clone a text style (local or remote) to a new local style with token replacement
   * This ensures non-destructive editing - the original style is not modified
   */
  private async cloneStyleWithTokenReplacement(
    sourceStyle: TextStyle,
    sourceTokenId: string,
    targetVariable: Variable
  ): Promise<string> {
    // Generate unique local style name
    const suffix = sourceStyle.remote ? ' (Local)' : ' (Updated)';
    const baseName = `${sourceStyle.name}${suffix}`;
    let localStyleName = baseName;
    let counter = 2;

    // Check for naming conflicts and generate unique name
    const existingStyles = await figma.getLocalTextStylesAsync();
    const existingNames = new Set(existingStyles.map((s) => s.name));

    while (existingNames.has(localStyleName)) {
      localStyleName = `${baseName.replace(suffix, '')} ${counter}${suffix}`;
      counter++;
    }

    // Load the source style's font first (required before setting properties)
    try {
      await figma.loadFontAsync(sourceStyle.fontName);
    } catch (error) {
      console.warn(`[StyleClone] Failed to load source font:`, error);
    }

    // Create new local text style
    const localStyle = figma.createTextStyle();
    localStyle.name = localStyleName;

    // Copy all properties from source style
    localStyle.fontName = sourceStyle.fontName;
    localStyle.fontSize = sourceStyle.fontSize;
    localStyle.letterSpacing = sourceStyle.letterSpacing;
    localStyle.lineHeight = sourceStyle.lineHeight;
    localStyle.paragraphIndent = sourceStyle.paragraphIndent;
    localStyle.paragraphSpacing = sourceStyle.paragraphSpacing;
    localStyle.textCase = sourceStyle.textCase;
    localStyle.textDecoration = sourceStyle.textDecoration;
    localStyle.description = sourceStyle.description || '';

    // Copy fills (colors)
    if (sourceStyle.paints && sourceStyle.paints.length > 0) {
      localStyle.paints = JSON.parse(JSON.stringify(sourceStyle.paints));
    }

    // Copy variable bindings from source style, replacing the source token with target
    if (sourceStyle.boundVariables) {
      for (const [property, bindings] of Object.entries(sourceStyle.boundVariables)) {
        const bindingArray = Array.isArray(bindings) ? bindings : [bindings];

        // Build the list of variables for this property
        const variablesToBind: Variable[] = [];

        for (const binding of bindingArray) {
          if (binding && typeof binding === 'object' && 'id' in binding) {
            let variableToUse: Variable | null = null;

            if (binding.id === sourceTokenId) {
              // Use target variable for source token
              variableToUse = targetVariable;

              // Load font if changing fontFamily
              if (property === 'fontFamily') {
                const targetValue = targetVariable.valuesByMode[Object.keys(targetVariable.valuesByMode)[0]];
                if (typeof targetValue === 'string') {
                  // Variable contains just the family name
                  // Style comes from the source style's fontName
                  const family = targetValue;
                  const style = sourceStyle.fontName.style;

                  try {
                    await figma.loadFontAsync({ family, style });
                  } catch (error) {
                    // Try with Regular as fallback
                    if (style !== 'Regular') {
                      try {
                        await figma.loadFontAsync({ family, style: 'Regular' });
                      } catch (fallbackError) {
                        console.warn(`[StyleClone] Failed to load font ${family} ${style}:`, fallbackError);
                      }
                    }
                  }
                }
              }
            } else {
              // Keep original binding
              variableToUse = await figma.variables.getVariableByIdAsync(binding.id);
            }

            if (variableToUse) {
              variablesToBind.push(variableToUse);
            }
          }
        }

        // Set the variable bindings for this property
        if (variablesToBind.length > 0) {
          try {
            // For single binding, pass the variable directly
            if (variablesToBind.length === 1) {
              localStyle.setBoundVariable(property as any, variablesToBind[0]);
            } else {
              // For multiple bindings, we need to call setBoundVariable multiple times
              for (const variable of variablesToBind) {
                localStyle.setBoundVariable(property as any, variable);
              }
            }
          } catch (error) {
            console.warn(`[StyleClone] Failed to bind ${property}:`, error);
          }
        }
      }
    }

    return localStyle.id;
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
   * Process token replacement with adaptive batching and error recovery
   */
  private async processTokenReplacement(
    options: TokenReplacementOptions
  ): Promise<Omit<ReplacementResult, 'checkpointTitle' | 'duration'>> {
    const { affectedLayerIds, targetTokenId } = options;

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


    // Track which styles we've already processed (to avoid duplicate replacements)
    const processedStyles = new Set<string>();
    // Track remote style ID → local clone ID mappings
    const remoteToLocalStyleMap = new Map<string, string>();

    // Get the target variable node (required for new API)
    const targetVariable = await figma.variables.getVariableByIdAsync(targetTokenId);
    if (!targetVariable) {
      throw new Error(`Target token not found: ${targetTokenId}`);
    }

    // Process layers with adaptive batching
    for await (const _ of batchProcessor.processBatches(affectedLayerIds, async (layerId) => {
      // Check for cancellation before processing each layer
      if (this.cancelRequested) {
        throw new Error('Replacement cancelled by user');
      }

      try {
        // Get the text node
        const node = await figma.getNodeByIdAsync(layerId);
        if (!node || node.type !== 'TEXT') {
          throw new Error('Layer is not a text node');
        }

        const textNode = node as TextNode;

        // DEBUG: Log layer info for investigation

        // Check if layer has direct token bindings
        const boundVariables = node.boundVariables || {};
        let foundDirectToken = false;
        let foundInStyle = false;
        let replacementCount = 0;


        // Replace token binding on the layer (direct bindings)
        if ('setBoundVariable' in node && typeof node.setBoundVariable === 'function') {
          // Check each property for token bindings
          for (const [property, bindings] of Object.entries(boundVariables)) {
            const bindingArray = Array.isArray(bindings) ? bindings : [bindings];
            let hasSourceToken = false;

            // Check if this property has the source token
            for (const binding of bindingArray) {
              if (
                binding &&
                typeof binding === 'object' &&
                binding.id === options.sourceTokenId
              ) {
                hasSourceToken = true;
                break;
              }
            }

            if (hasSourceToken) {
              // Found the source token - replace it with target token
              foundDirectToken = true;

              // Load font if we're changing fontFamily
              if (property === 'fontFamily' && node.type === 'TEXT') {
                const textNode = node as TextNode;
                // Get the font family from the target variable's value
                const targetValue = targetVariable.valuesByMode[Object.keys(targetVariable.valuesByMode)[0]];
                if (typeof targetValue === 'string') {
                  // Variable contains just the family name (e.g., "Menlo")
                  // Style comes from the text node's current fontName
                  const family = targetValue;
                  const style = textNode.fontName !== figma.mixed ? textNode.fontName.style : 'Regular';

                  try {
                    await figma.loadFontAsync({ family, style });
                  } catch (error) {
                    // Try with Regular as fallback
                    if (style !== 'Regular') {
                      try {
                        await figma.loadFontAsync({ family, style: 'Regular' });
                      } catch (fallbackError) {
                        console.warn(`[TokenReplacement] Failed to load font ${family} ${style}:`, fallbackError);
                      }
                    }
                  }
                }
              }

              // Build new bindings array: keep non-source tokens and add target token
              const newBindings = bindingArray
                .filter(b => b && typeof b === 'object' && b.id !== options.sourceTokenId)
                .map(b => ({ type: 'VARIABLE_ALIAS' as const, id: b.id }));

              // Add the target token
              newBindings.push({ type: 'VARIABLE_ALIAS' as const, id: targetVariable.id });

              // Set the new bindings (replace entire array)
              if (newBindings.length === 1) {
                // Single binding - use the variable node directly
                node.setBoundVariable(property as any, targetVariable);
              } else {
                // Multiple bindings - need to set as array
                // First, unbind the property
                try {
                  (node as any).setBoundVariable(property, null);
                } catch (e) {
                  // Ignore errors from unbinding
                }
                // Then set each variable
                for (const binding of newBindings) {
                  const variable = await figma.variables.getVariableByIdAsync(binding.id);
                  if (variable) {
                    node.setBoundVariable(property as any, variable);
                  }
                }
              }

              replacementCount++;
            }
          }
        }

        // Check if layer has a text style with the source token
        // This must be checked REGARDLESS of whether there's a direct binding,
        // because style bindings override direct bindings
        if (textNode.textStyleId) {

          // Check if this style has already been cloned
          if (remoteToLocalStyleMap.has(textNode.textStyleId)) {
            const localStyleId = remoteToLocalStyleMap.get(textNode.textStyleId)!;
            // Apply the existing cloned style
            await textNode.setTextStyleIdAsync(localStyleId);

            // Important: Don't return yet! We may have already replaced a direct binding above,
            // or the layer may have been incorrectly added via style propagation.
            // Only count this as a replacement if we didn't already replace a direct binding.
            if (!foundDirectToken) {
              replacementCount++;
            }
            foundInStyle = true;
            // Continue to check if there was a direct token replacement
          }

          // Check if we've already processed this style
          if (processedStyles.has(textNode.textStyleId)) {
            // Style already processed - this layer is covered
            // Don't throw error - this is a success (style was already replaced)
            return;
          }

          // Check if the style has the source token
          const style = await figma.getStyleByIdAsync(textNode.textStyleId);
          if (style && style.type === 'TEXT') {
            const styleBoundVariables = style.boundVariables || {};
            let styleHasSourceToken = false;


            for (const [property, bindings] of Object.entries(styleBoundVariables)) {
              const bindingArray = Array.isArray(bindings) ? bindings : [bindings];
              for (const binding of bindingArray) {
                if (
                  binding &&
                  typeof binding === 'object' &&
                  binding.id === options.sourceTokenId
                ) {
                  styleHasSourceToken = true;
                  break;
                }
              }
              if (styleHasSourceToken) break;
            }

            if (styleHasSourceToken) {
              // Style has the source token - clone it
              // Clone the style with token replacement
              const newLocalStyleId = await this.cloneStyleWithTokenReplacement(
                style,
                options.sourceTokenId,
                targetVariable
              );

              // Save the mapping from original style ID to cloned style ID
              remoteToLocalStyleMap.set(textNode.textStyleId, newLocalStyleId);
              processedStyles.add(textNode.textStyleId);

              // Apply the new cloned style to this layer
              await textNode.setTextStyleIdAsync(newLocalStyleId);

              // Mark that we found and replaced via style
              foundInStyle = true;

              // Only increment replacementCount if we didn't already replace a direct binding
              if (!foundDirectToken) {
                replacementCount++;
              }

              // Continue to check if we also need to handle direct token replacement
            }
          }
        }

        // If we get here and haven't found the token anywhere, it's an error
        // UNLESS we already successfully replaced a direct binding
        if (!foundDirectToken && !foundInStyle) {
          // Get the actual fontFamily binding to see what token it has
          const fontFamilyBinding = boundVariables.fontFamily;
          const fontFamilyTokenId = fontFamilyBinding && !Array.isArray(fontFamilyBinding) && 'id' in fontFamilyBinding
            ? fontFamilyBinding.id
            : Array.isArray(fontFamilyBinding) && fontFamilyBinding.length > 0 && 'id' in fontFamilyBinding[0]
            ? fontFamilyBinding[0].id
            : 'none';

          console.error(`[TokenReplacement] FAILURE - Token not found anywhere:`, {
            layerId: layerId,
            layerName: textNode.name,
            hasStyle: !!textNode.textStyleId,
            styleId: textNode.textStyleId,
            styleWasCloned: textNode.textStyleId ? remoteToLocalStyleMap.has(textNode.textStyleId) : false,
            hasBoundVariables: !!boundVariables && Object.keys(boundVariables).length > 0,
            boundVariableProperties: boundVariables ? Object.keys(boundVariables) : [],
            searchingForTokenId: options.sourceTokenId,
            actualFontFamilyTokenId: fontFamilyTokenId
          });
          throw new Error(`Source token not found on layer (checked both direct bindings and style)`);
        }

        // If we found the token but didn't make any replacements, that's also an error
        if (replacementCount === 0 && !foundDirectToken && !foundInStyle) {
          throw new Error(`Source token found but replacement failed`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[TokenReplacement] Failed to process layer ${layerId}:`, errorMessage);
        throw {
          layerId,
          layerName: (await figma.getNodeByIdAsync(layerId))?.name || layerId,
          error: error instanceof Error ? error : new Error(String(error)),
          retryCount: 0,
        };
      }
    })) {
      // Batch processed - progress emitted via callback
    }

    console.log(`Token replacement complete: ${layersUpdated} updated, ${layersFailed} failed`);

    return {
      success: layersFailed === 0,
      layersUpdated,
      layersFailed,
      failedLayers,
      hasWarnings: layersFailed > 0,
    };
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
}

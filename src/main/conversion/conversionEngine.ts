/**
 * Conversion Engine - Convert Remote Styles to Local Styles
 *
 * Handles the conversion of remote text styles to local styles with optional property overrides.
 * Supports both manual property values and design token bindings.
 */

import type {
  ConversionRequest,
  ConversionResult,
  ConversionMapping,
  PropertyOverrideMap,
  PropertyOverrideValue,
  TextStyle,
  LineHeight,
  LetterSpacing,
  RGBA,
} from '@/shared/types';

import { traverseTextNodes, traverseTextNodesStreaming } from '@/main/utils/traversal';
import { yieldForGC, releaseArray, logMemoryUsage } from './memoryUtils';
import {
  categorizeTextNodes,
  clearMainComponentCache,
  getMainComponentCacheSize,
  type TextNodeCategory,
} from '@/main/utils/nodeCategorization';

// Maximum number of errors to collect to prevent memory issues during failing conversions
const MAX_ERRORS = 100;

/**
 * Safely add error(s) to the errors array with a cap to prevent unbounded growth
 */
function addError(errors: string[], error: string | string[]): void {
  if (errors.length >= MAX_ERRORS + 1) return; // Already capped

  if (Array.isArray(error)) {
    // For spread operations like errors.push(...result.errors)
    for (const e of error) {
      if (errors.length >= MAX_ERRORS) {
        if (errors.length === MAX_ERRORS) {
          errors.push(`... additional errors truncated (limit: ${MAX_ERRORS})`);
        }
        return;
      }
      errors.push(e);
    }
  } else {
    if (errors.length === MAX_ERRORS) {
      errors.push(`... additional errors truncated (limit: ${MAX_ERRORS})`);
      return;
    }
    errors.push(error);
  }
}

/**
 * Build a map of style IDs to text layers using streaming document traversal
 *
 * MEMORY OPTIMIZED: Uses streaming callback pattern instead of collecting all nodes
 * in an array. This prevents the 75MB+ memory spike that occurs with large documents.
 *
 * PERFORMANCE: Still traverses document only ONCE (O(N) where N = total nodes).
 *
 * @param styleIds - Array of style IDs to find layers for
 * @param cancelFn - Optional function that returns true if operation should be cancelled
 * @returns Map of style ID to array of layer IDs (not node references - memory optimization)
 */
async function buildStyleToLayersMap(
  styleIds: string[],
  cancelFn?: () => boolean
): Promise<{ [styleId: string]: string[] }> {
  console.log(`[ConversionEngine] Building style-to-layers map for ${styleIds.length} styles (streaming)...`);

  const map: { [styleId: string]: string[] } = {};
  const styleIdSet = new Set(styleIds);

  // Initialize map with empty arrays
  for (const styleId of styleIds) {
    map[styleId] = [];
  }

  // MEMORY OPTIMIZATION: Stream through nodes without accumulating them in memory
  // This prevents the 75MB+ memory spike from collecting 50,000+ nodes at once
  logMemoryUsage('Before streaming traversal');

  const processedCount = await traverseTextNodesStreaming(
    figma.root,
    (node) => {
      // Only store ID if this node uses one of our target styles
      if (node.textStyleId && styleIdSet.has(node.textStyleId)) {
        map[node.textStyleId].push(node.id);
      }
    },
    {
      cancelFn,
      yieldEvery: 50, // Yield frequently to allow GC
      onProgress: (count) => {
        if (count % 500 === 0) {
          console.log(`[ConversionEngine] Processed ${count} text nodes...`);
        }
      },
    }
  );

  logMemoryUsage('After streaming traversal');

  // Log statistics
  const totalLayers = Object.values(map).reduce((sum, layers) => sum + layers.length, 0);
  console.log(`[ConversionEngine] Scanned ${processedCount} text nodes, mapped ${totalLayers} layer IDs to ${styleIds.length} styles`);

  return map;
}

// NOTE: Node categorization logic has been extracted to @/main/utils/nodeCategorization
// This reduces code duplication between conversion and replacement engines

/**
 * Apply a style to layers in batches with progress callbacks
 *
 * MEMORY OPTIMIZATION: Accepts layer IDs and retrieves nodes on-demand per batch.
 * This prevents holding all node references in memory simultaneously.
 *
 * PERFORMANCE: Uses adaptive batching (100→25→100) to:
 * - Prevent memory accumulation
 * - Yield to event loop (prevent "Plugin not responding")
 * - Recover from errors gracefully
 *
 * @param layerIds - Array of layer IDs to update (not node references)
 * @param newStyleId - ID of the style to apply
 * @param progressCallback - Optional callback for progress updates
 * @param cancelFn - Optional function that returns true if operation should be cancelled
 * @returns Statistics about the operation
 */
async function applyStyleToLayersInBatches(
  layerIds: string[],
  newStyleId: string,
  progressCallback?: (updated: number, total: number) => void,
  cancelFn?: () => boolean
): Promise<{ updated: number; failed: number; errors: string[] }> {
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];
  const total = layerIds.length;

  // MEMORY OPTIMIZATION: Smaller batch sizes for memory stability
  // Adaptive batch sizing: smaller batches for larger operations to prevent memory spikes
  let BATCH_SIZE = 25; // Reduced from 100 for better memory management
  if (total > 1000) {
    BATCH_SIZE = 10; // Even smaller for very large operations
    console.log(`[ConversionEngine] Large operation (${total} layers) - using smaller batch size: ${BATCH_SIZE}`);
  }

  console.log(`[ConversionEngine] Applying style to ${total} layers in batches of ${BATCH_SIZE}...`);

  // Process in batches - retrieve nodes on-demand
  for (let i = 0; i < total; i += BATCH_SIZE) {
    // Check for cancellation
    if (cancelFn?.()) {
      console.log('[ConversionEngine] Conversion cancelled by user');
      break;
    }

    const batchIds = layerIds.slice(i, Math.min(i + BATCH_SIZE, total));
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    // Retrieve nodes for this batch only
    const nodes = await Promise.all(
      batchIds.map(async (id) => {
        try {
          return await figma.getNodeByIdAsync(id);
        } catch (error) {
          return null; // Node may have been deleted
        }
      })
    );

    // Process batch
    for (let j = 0; j < nodes.length; j++) {
      const node = nodes[j];
      if (node?.type === 'TEXT') {
        try {
          (node as TextNode).textStyleId = newStyleId;
          updated++;
        } catch (error) {
          failed++;
          addError(errors, `Layer ${node.name}: ${(error as Error).message}`);
        }
      } else {
        failed++;
        if (node) {
          addError(errors, `Layer ${node.name}: Not a text node`);
        } else {
          addError(errors, `Layer ${batchIds[j]}: Node not found (may have been deleted)`);
        }
      }
    }

    // Release batch node references
    releaseArray(nodes);

    // Emit progress callback
    if (progressCallback) {
      progressCallback(updated + failed, total);
    }

    // Log batch completion
    console.log(
      `[ConversionEngine] Batch ${batchNumber}: ${nodes.length} layers processed (${updated} updated, ${failed} failed so far)`
    );

    // Yield to event loop for GC
    await yieldForGC();
  }

  console.log(`[ConversionEngine] Applied style to ${updated}/${total} layers (${failed} failed)`);

  return { updated, failed, errors };
}

/**
 * Scan document to find all text nodes using a specific style
 *
 * DEPRECATED: Use buildStyleToLayersMap() for better performance when processing multiple styles.
 * This function is kept for backward compatibility.
 */
function findLayersUsingStyle(styleId: string): TextNode[] {
  const affectedLayers: TextNode[] = [];

  function traverse(node: BaseNode) {
    if (node.type === 'TEXT') {
      const textNode = node as TextNode;
      if (textNode.textStyleId === styleId) {
        affectedLayers.push(textNode);
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  // Traverse all pages
  for (const page of figma.root.children) {
    traverse(page);
  }

  return affectedLayers;
}

/**
 * Convert remote styles to local styles with optional property overrides
 */
export async function convertStylesToLocal(
  request: ConversionRequest
): Promise<ConversionResult> {
  const startTime = Date.now();
  const {
    sourceStyleIds,
    propertyOverrides,
    applyToLayers = true,
    progressCallback,
    cancelFn,
  } = request as any; // Cast to any to access optional new properties

  console.log(`[ConversionEngine] Converting ${sourceStyleIds.length} styles with overrides:`, propertyOverrides);
  console.log(`[ConversionEngine] Apply to layers: ${applyToLayers}`);

  // CRITICAL MEMORY OPTIMIZATION: Skip invisible nodes within instances
  // This can reduce traversal from 50,000 nodes to 5,000 nodes in component-heavy documents
  // Figma docs: "setting figma.skipInvisibleInstanceChildren = true is recommended for
  // substantial speed improvements in document traversal"
  const previousSkipInvisibleSetting = figma.skipInvisibleInstanceChildren;
  figma.skipInvisibleInstanceChildren = true;
  console.log(`[ConversionEngine] Enabled skipInvisibleInstanceChildren (was: ${previousSkipInvisibleSetting})`);

  const newLocalStyles: TextStyle[] = [];
  const stylesMapped: ConversionMapping[] = [];
  const errors: string[] = [];
  let layersAffected = 0;
  let checkpointCreated = false;

  // Phase 1: Validation (0-5%)
  if (progressCallback) {
    progressCallback({
      state: 'validating',
      phase: 'styles',
      percentage: 0,
      totalStyles: sourceStyleIds.length,
    });
  }

  // Create version history checkpoint if applying to layers (5-10%)
  if (applyToLayers) {
    if (progressCallback) {
      progressCallback({
        state: 'creating_checkpoint',
        phase: 'styles',
        percentage: 5,
      });
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      await figma.saveVersionHistoryAsync(`Convert to Local Styles - ${timestamp}`);
      checkpointCreated = true;
      console.log(`[ConversionEngine] Version history checkpoint created`);
    } catch (error) {
      console.warn(`[ConversionEngine] Failed to create version checkpoint:`, error);
      // Continue anyway - this is not a critical error
    }
  }

  // Phase 2: Scan document ONCE to build style-to-layers map (10-20%)
  // MEMORY OPTIMIZATION: Map contains layer IDs (strings), not node references
  let styleToLayersMap: { [styleId: string]: string[] } = {};
  if (applyToLayers) {
    if (progressCallback) {
      progressCallback({
        state: 'scanning',
        phase: 'layers',
        percentage: 10,
      });
    }

    styleToLayersMap = await buildStyleToLayersMap(sourceStyleIds, cancelFn);

    if (progressCallback) {
      progressCallback({
        state: 'scanning',
        phase: 'layers',
        percentage: 20,
      });
    }
  }

  // Get existing local style names to avoid conflicts
  const existingNames = new Set(figma.getLocalTextStyles().map(s => s.name));

  // Phase 3: Create local styles with overrides (20-50%)
  let styleIndex = 0;
  for (const styleId of sourceStyleIds) {
    try {
      // Check for cancellation
      if (cancelFn && cancelFn()) {
        throw new Error('Conversion cancelled by user');
      }

      // Get source style
      const sourceStyle = await figma.getStyleByIdAsync(styleId);
      if (!sourceStyle || sourceStyle.type !== 'TEXT') {
        addError(errors, `Style ${styleId} not found or not a text style`);
        continue;
      }

      // Resolve name conflict
      const newStyleName = resolveNameConflict(sourceStyle.name, existingNames);
      existingNames.add(newStyleName); // Track for subsequent iterations

      // Create local style with overrides
      const newFigmaStyle = await createLocalStyleWithOverrides(
        sourceStyle as any,
        newStyleName,
        propertyOverrides
      );

      // Build TextStyle object for return value
      const styleData = buildTextStyleData(newFigmaStyle);

      newLocalStyles.push(styleData);
      stylesMapped.push({
        sourceStyleId: styleId,
        sourceStyleName: sourceStyle.name,
        newStyleId: newFigmaStyle.id,
        newStyleName: newFigmaStyle.name,
      });

      console.log(`[ConversionEngine] Created local style: ${newStyleName} (from ${sourceStyle.name})`);

      // Report progress
      styleIndex++;
      if (progressCallback) {
        const percentage = 20 + Math.round((styleIndex / sourceStyleIds.length) * 30); // 20-50%
        progressCallback({
          state: 'converting',
          phase: 'styles',
          percentage,
          stylesCreated: styleIndex,
          totalStyles: sourceStyleIds.length,
          currentStyleName: newStyleName,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addError(errors, `Failed to convert style ${styleId}: ${errorMsg}`);
      console.error(`[ConversionEngine] Error converting style ${styleId}:`, error);
    }
  }

  // Phase 4: Apply styles to layers using component-aware processing (50-100%)
  let layersSkipped = 0;
  // Track category breakdown for reporting
  const categoryBreakdown = {
    mainComponents: 0,
    libraryInstances: 0,
    detachedInstances: 0,
    instancesWithOverride: 0,
    plainText: 0,
  };

  if (applyToLayers && stylesMapped.length > 0) {
    let totalLayersProcessed = 0;
    const totalLayersToProcess = Object.values(styleToLayersMap).reduce(
      (sum, layers) => sum + layers.length,
      0
    );

    for (const mapping of stylesMapped) {
      const layers = styleToLayersMap[mapping.sourceStyleId] || [];

      if (layers.length === 0) {
        console.log(`[ConversionEngine] No layers found for style ${mapping.sourceStyleName}`);
        continue;
      }

      console.log(
        `[ConversionEngine] Applying style ${mapping.newStyleName} to ${layers.length} layers using component-aware processing...`
      );

      try {
        // COMPONENT-AWARE OPTIMIZATION: Categorize layers before processing
        // This allows us to process in optimal order and skip inheriting instances
        logMemoryUsage('Before node categorization');
        const categories = await categorizeTextNodes(layers, {
          cancelFn,
          logPrefix: 'ConversionEngine',
        });
        logMemoryUsage('After node categorization');

        // Track total skipped for this style
        const skippedForStyle = categories.localInstanceNoOverride.length;
        layersSkipped += skippedForStyle;

        console.log(
          `[ConversionEngine] Category breakdown for ${mapping.newStyleName}:`,
          {
            mainComponents: categories.localMainComponent.length,
            libraryInstances: categories.libraryInstance.length,
            detachedInstances: categories.detachedInstance.length,
            instancesWithOverride: categories.localInstanceWithOverride.length,
            instancesNoOverride: categories.localInstanceNoOverride.length,
            plainText: categories.plainText.length,
            willSkip: skippedForStyle,
          }
        );

        // Process categories in optimal order
        let categoryUpdated = 0;

        // Step 1: Update LOCAL main components FIRST
        // This triggers automatic propagation to inheriting instances
        if (categories.localMainComponent.length > 0) {
          console.log(
            `[ConversionEngine] [1/5] Processing ${categories.localMainComponent.length} main component text nodes...`
          );
          const result = await applyStyleToLayersInBatches(
            categories.localMainComponent,
            mapping.newStyleId,
            (updated, total) => {
              const phaseProgress = (totalLayersProcessed + categoryUpdated + updated) / totalLayersToProcess;
              const percentage = 50 + Math.round(phaseProgress * 50);
              if (progressCallback) {
                progressCallback({
                  state: 'applying',
                  phase: 'layers',
                  percentage,
                  layersProcessed: totalLayersProcessed + categoryUpdated + updated,
                  totalLayers: totalLayersToProcess,
                });
              }
            },
            cancelFn
          );
          categoryUpdated += result.updated;
          categoryBreakdown.mainComponents += result.updated;
          if (result.errors.length > 0) addError(errors, result.errors);
        }

        // Step 2: Yield to allow Figma to propagate main component changes
        await new Promise(resolve => setTimeout(resolve, 10));

        // Step 3: Update library instance text (can't modify library main)
        if (categories.libraryInstance.length > 0) {
          console.log(
            `[ConversionEngine] [2/5] Processing ${categories.libraryInstance.length} library instance text nodes...`
          );
          const result = await applyStyleToLayersInBatches(
            categories.libraryInstance,
            mapping.newStyleId,
            (updated, total) => {
              const phaseProgress = (totalLayersProcessed + categoryUpdated + updated) / totalLayersToProcess;
              const percentage = 50 + Math.round(phaseProgress * 50);
              if (progressCallback) {
                progressCallback({
                  state: 'applying',
                  phase: 'layers',
                  percentage,
                  layersProcessed: totalLayersProcessed + categoryUpdated + updated,
                  totalLayers: totalLayersToProcess,
                });
              }
            },
            cancelFn
          );
          categoryUpdated += result.updated;
          categoryBreakdown.libraryInstances += result.updated;
          if (result.errors.length > 0) addError(errors, result.errors);
        }

        // Step 4: Update detached instances (no main component)
        if (categories.detachedInstance.length > 0) {
          console.log(
            `[ConversionEngine] [3/5] Processing ${categories.detachedInstance.length} detached instance text nodes...`
          );
          const result = await applyStyleToLayersInBatches(
            categories.detachedInstance,
            mapping.newStyleId,
            (updated, total) => {
              const phaseProgress = (totalLayersProcessed + categoryUpdated + updated) / totalLayersToProcess;
              const percentage = 50 + Math.round(phaseProgress * 50);
              if (progressCallback) {
                progressCallback({
                  state: 'applying',
                  phase: 'layers',
                  percentage,
                  layersProcessed: totalLayersProcessed + categoryUpdated + updated,
                  totalLayers: totalLayersToProcess,
                });
              }
            },
            cancelFn
          );
          categoryUpdated += result.updated;
          categoryBreakdown.detachedInstances += result.updated;
          if (result.errors.length > 0) addError(errors, result.errors);
        }

        // Step 5: Update local instances WITH override
        if (categories.localInstanceWithOverride.length > 0) {
          console.log(
            `[ConversionEngine] [4/5] Processing ${categories.localInstanceWithOverride.length} instance text nodes with overrides...`
          );
          const result = await applyStyleToLayersInBatches(
            categories.localInstanceWithOverride,
            mapping.newStyleId,
            (updated, total) => {
              const phaseProgress = (totalLayersProcessed + categoryUpdated + updated) / totalLayersToProcess;
              const percentage = 50 + Math.round(phaseProgress * 50);
              if (progressCallback) {
                progressCallback({
                  state: 'applying',
                  phase: 'layers',
                  percentage,
                  layersProcessed: totalLayersProcessed + categoryUpdated + updated,
                  totalLayers: totalLayersToProcess,
                });
              }
            },
            cancelFn
          );
          categoryUpdated += result.updated;
          categoryBreakdown.instancesWithOverride += result.updated;
          if (result.errors.length > 0) addError(errors, result.errors);
        }

        // Step 6: Update plain text (not in components)
        if (categories.plainText.length > 0) {
          console.log(
            `[ConversionEngine] [5/5] Processing ${categories.plainText.length} plain text nodes...`
          );
          const result = await applyStyleToLayersInBatches(
            categories.plainText,
            mapping.newStyleId,
            (updated, total) => {
              const phaseProgress = (totalLayersProcessed + categoryUpdated + updated) / totalLayersToProcess;
              const percentage = 50 + Math.round(phaseProgress * 50);
              if (progressCallback) {
                progressCallback({
                  state: 'applying',
                  phase: 'layers',
                  percentage,
                  layersProcessed: totalLayersProcessed + categoryUpdated + updated,
                  totalLayers: totalLayersToProcess,
                });
              }
            },
            cancelFn
          );
          categoryUpdated += result.updated;
          categoryBreakdown.plainText += result.updated;
          if (result.errors.length > 0) addError(errors, result.errors);
        }

        // Step 7: Log skipped nodes (inheriting instances)
        if (categories.localInstanceNoOverride.length > 0) {
          console.log(
            `[ConversionEngine] ✓ Skipped ${categories.localInstanceNoOverride.length} instance text nodes (will inherit from main component)`
          );
        }

        layersAffected += categoryUpdated;
        totalLayersProcessed += layers.length;

        console.log(
          `[ConversionEngine] Applied style ${mapping.newStyleName} to ${categoryUpdated}/${layers.length} layers (${skippedForStyle} skipped)`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        addError(errors, `Failed to apply style ${mapping.newStyleName}: ${errorMsg}`);
        console.error(
          `[ConversionEngine] Error applying style ${mapping.newStyleName}:`,
          error
        );
      }
    }
  }

  const duration = Date.now() - startTime;
  const totalConverted = stylesMapped.length;
  const totalFailed = sourceStyleIds.length - totalConverted;

  console.log(
    `[ConversionEngine] Conversion complete: ${totalConverted} succeeded, ${totalFailed} failed in ${duration}ms`
  );
  if (applyToLayers) {
    console.log(`[ConversionEngine] Applied styles to ${layersAffected} layers, skipped ${layersSkipped} inheriting instances`);
  }

  // Restore previous skipInvisibleInstanceChildren setting
  figma.skipInvisibleInstanceChildren = previousSkipInvisibleSetting;
  console.log(`[ConversionEngine] Restored skipInvisibleInstanceChildren to: ${previousSkipInvisibleSetting}`);

  // Clear main component cache to free memory
  const cacheSize = getMainComponentCacheSize();
  clearMainComponentCache();
  console.log(`[ConversionEngine] Cleared main component cache (${cacheSize} entries freed)`);

  return {
    newLocalStyles,
    stylesMapped,
    totalConverted,
    totalFailed,
    errors,
    duration,
    layersAffected: applyToLayers ? layersAffected : undefined,
    layersSkipped: applyToLayers ? layersSkipped : undefined,
    checkpointCreated: applyToLayers ? checkpointCreated : undefined,
    categoryBreakdown: applyToLayers && layersAffected > 0 ? categoryBreakdown : undefined,
  };
}

/**
 * Create a local style from a source style with property overrides
 */
async function createLocalStyleWithOverrides(
  sourceStyle: any, // Figma TextStyle
  newStyleName: string,
  overrides: PropertyOverrideMap
): Promise<any> { // Returns Figma TextStyle
  // Load the source font first
  try {
    await figma.loadFontAsync(sourceStyle.fontName);
  } catch (error) {
    console.warn(`[ConversionEngine] Failed to load source font:`, error);
    throw new Error(
      `Cannot load font "${sourceStyle.fontName.family} ${sourceStyle.fontName.style}". ` +
        `The font may be missing from your system.`
    );
  }

  // Create new local text style
  const localStyle = figma.createTextStyle();
  localStyle.name = newStyleName;

  // Copy ALL properties from source style
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
  // MEMORY OPTIMIZATION: Use shallow copy instead of deep clone (JSON.parse/stringify)
  // Paint objects are read-only after creation, so deep clone is unnecessary
  if (sourceStyle.paints && sourceStyle.paints.length > 0) {
    localStyle.paints = [...sourceStyle.paints];
  }

  // Copy variable bindings from source style
  if (sourceStyle.boundVariables) {
    for (const [property, bindings] of Object.entries(sourceStyle.boundVariables)) {
      const bindingArray = Array.isArray(bindings) ? bindings : [bindings];

      for (const binding of bindingArray) {
        if (binding && typeof binding === 'object' && 'id' in binding) {
          try {
            const variable = await figma.variables.getVariableByIdAsync(binding.id);
            if (variable) {
              localStyle.setBoundVariable(property as any, variable);
            }
          } catch (error) {
            console.warn(`[ConversionEngine] Failed to copy variable binding for ${property}:`, error);
          }
        }
      }
    }
  }

  // Apply property overrides
  await applyPropertyOverrides(localStyle, overrides);

  return localStyle;
}

/**
 * Build TextStyle data object from Figma TextStyle
 */
function buildTextStyleData(figmaStyle: any): TextStyle {
  // Extract font properties
  const fontFamily = figmaStyle.fontName?.family || 'Unknown';
  const fontSize = figmaStyle.fontSize || 16;
  const fontWeight = figmaStyle.fontName?.style ? parseFontWeight(figmaStyle.fontName.style) : 400;
  const lineHeight = figmaStyle.lineHeight ? extractLineHeight(figmaStyle.lineHeight) : { unit: 'AUTO' as const };
  const letterSpacing = figmaStyle.letterSpacing
    ? extractLetterSpacing(figmaStyle.letterSpacing)
    : { unit: 'PIXELS' as const, value: 0 };

  // Extract fills (text color)
  const fills: RGBA[] = [];
  if (figmaStyle.paints && Array.isArray(figmaStyle.paints)) {
    for (const paint of figmaStyle.paints) {
      if (paint.type === 'SOLID' && paint.visible !== false) {
        fills.push({
          r: paint.color.r,
          g: paint.color.g,
          b: paint.color.b,
          a: paint.opacity ?? 1,
        });
      }
    }
  }

  return {
    id: figmaStyle.id,
    name: figmaStyle.name,
    key: figmaStyle.key,

    hierarchyPath: parseStyleHierarchy(figmaStyle.name),
    parentStyleId: undefined,
    childStyleIds: [],

    sourceType: 'local',
    libraryName: 'Local',
    libraryId: 'local',

    usageCount: 0,
    pageDistribution: [],
    componentUsage: {
      mainComponentCount: 0,
      instanceCount: 0,
      plainLayerCount: 0,
      overrideCount: 0,
    },

    isDeprecated: false,
    lastModified: undefined,

    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    fills,

    tokens: [],
  };
}

/**
 * Parse style hierarchy from name (e.g., "Heading/H1" → ["Heading", "H1"])
 */
function parseStyleHierarchy(name: string): string[] {
  return name.split('/').map((s) => s.trim());
}

/**
 * Parse font weight from font style name
 */
function parseFontWeight(styleName: string): number {
  const lowerStyle = styleName.toLowerCase();
  if (lowerStyle.includes('thin')) return 100;
  if (lowerStyle.includes('extralight') || lowerStyle.includes('ultralight')) return 200;
  if (lowerStyle.includes('light')) return 300;
  if (lowerStyle.includes('medium')) return 500;
  if (lowerStyle.includes('semibold') || lowerStyle.includes('demibold')) return 600;
  if (lowerStyle.includes('bold')) return 700;
  if (lowerStyle.includes('extrabold') || lowerStyle.includes('ultrabold')) return 800;
  if (lowerStyle.includes('black') || lowerStyle.includes('heavy')) return 900;
  return 400; // Regular
}

/**
 * Extract line height value
 */
function extractLineHeight(lineHeight: any): LineHeight {
  if (lineHeight.unit === 'AUTO') {
    return { unit: 'AUTO' };
  } else if (lineHeight.unit === 'PIXELS') {
    return { value: lineHeight.value, unit: 'PIXELS' };
  } else if (lineHeight.unit === 'PERCENT') {
    return { value: lineHeight.value, unit: 'PERCENT' };
  }
  return { unit: 'AUTO' };
}

/**
 * Extract letter spacing value
 */
function extractLetterSpacing(letterSpacing: any): LetterSpacing {
  if (letterSpacing.unit === 'PIXELS') {
    return { value: letterSpacing.value, unit: 'PIXELS' };
  } else if (letterSpacing.unit === 'PERCENT') {
    return { value: letterSpacing.value, unit: 'PERCENT' };
  }
  return { value: 0, unit: 'PIXELS' };
}

/**
 * Apply property overrides to a text style
 */
async function applyPropertyOverrides(
  style: any, // Figma TextStyle
  overrides: PropertyOverrideMap
): Promise<void> {
  // Font Family
  if (overrides.fontFamily) {
    await applyFontFamilyOverride(style, overrides.fontFamily);
  }

  // Font Size
  if (overrides.fontSize) {
    await applyPropertyOverride(style, 'fontSize', overrides.fontSize);
  }

  // Font Weight
  if (overrides.fontWeight) {
    await applyFontWeightOverride(style, overrides.fontWeight);
  }

  // Line Height
  if (overrides.lineHeight) {
    await applyLineHeightOverride(style, overrides.lineHeight);
  }

  // Letter Spacing
  if (overrides.letterSpacing) {
    await applyLetterSpacingOverride(style, overrides.letterSpacing);
  }

  // Color (fills)
  if (overrides.color) {
    await applyColorOverride(style, overrides.color);
  }

  // Paragraph Spacing
  if (overrides.paragraphSpacing) {
    await applyPropertyOverride(style, 'paragraphSpacing', overrides.paragraphSpacing);
  }

  // Text Case
  if (overrides.textCase) {
    await applyTextCaseOverride(style, overrides.textCase);
  }

  // Text Decoration
  if (overrides.textDecoration) {
    await applyTextDecorationOverride(style, overrides.textDecoration);
  }
}

/**
 * Try to load a font with multiple fallback styles
 * Returns the style name that was successfully loaded, or null if none worked
 */
async function tryLoadFontWithFallbacks(family: string, preferredStyle: string): Promise<string | null> {
  // Common font style fallbacks in order of preference
  const fallbackStyles = ['Regular', 'Normal', 'Book', 'Medium', 'Roman', 'Light'];

  // Try the preferred style first
  const stylesToTry = [preferredStyle];

  // Add fallbacks (avoid duplicates)
  for (const fallback of fallbackStyles) {
    if (fallback !== preferredStyle && !stylesToTry.includes(fallback)) {
      stylesToTry.push(fallback);
    }
  }

  // Try each style in order
  for (const style of stylesToTry) {
    try {
      await figma.loadFontAsync({ family, style });
      if (style !== preferredStyle) {
        console.log(`[ConversionEngine] Loaded ${family} ${style} as fallback for ${preferredStyle}`);
      }
      return style; // Return the style that actually loaded
    } catch (error) {
      // Continue to next fallback
      continue;
    }
  }

  return null; // No style could be loaded
}

/**
 * Apply font family override
 */
async function applyFontFamilyOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  console.log('[ConversionEngine] applyFontFamilyOverride called with:', {
    type: override.type,
    tokenId: override.type === 'token' ? override.tokenId : undefined,
    tokenName: override.type === 'token' ? override.tokenName : undefined,
    value: override.type === 'manual' ? override.value : undefined,
  });

  if (override.type === 'manual') {
    // Manual font family value - need to load the font
    const family = String(override.value);
    const currentStyle = style.fontName.style;

    const loadedStyle = await tryLoadFontWithFallbacks(family, currentStyle);
    if (!loadedStyle) {
      throw new Error(
        `Cannot load font "${family}". The font may be missing from your system.`
      );
    }

    // Update the font name with the style that actually loaded
    style.fontName = { family, style: loadedStyle };
    console.log(`[ConversionEngine] Applied manual font family override: ${family} ${loadedStyle}`);
  } else {
    // Token binding - bind the variable to fontFamily
    // Try to get the variable - could be local (ID) or remote (key)
    let variable = await figma.variables.getVariableByIdAsync(override.tokenId);

    // If not found by ID, try importing by key (for library variables)
    if (!variable) {
      try {
        variable = await figma.variables.importVariableByKeyAsync(override.tokenId);
      } catch (importError) {
        console.warn(`[ConversionEngine] Failed to import variable ${override.tokenName}:`, importError);
      }
    }

    if (!variable) {
      throw new Error(`Token ${override.tokenName} not found (ID: ${override.tokenId})`);
    }

    // When binding a fontFamily variable, Figma requires the TARGET font to be loaded
    // The target is: variable value (e.g., "Menlo") + current style weight (e.g., "Bold")
    // We need to load the target font with fallback styles before binding
    const originalWeight = style.fontName.style;

    // Get the variable value (the target font family)
    const variableValue = variable.valuesByMode[Object.keys(variable.valuesByMode)[0]];
    const targetFamily = String(variableValue);

    console.log(
      `[ConversionEngine] Preparing to bind fontFamily variable:`,
      {
        variableName: variable.name,
        targetFamily,
        originalFamily: style.fontName.family,
        originalWeight,
      }
    );

    // Try to load the target font with the original weight, then fallbacks
    const loadedStyle = await tryLoadFontWithFallbacks(targetFamily, originalWeight);

    if (!loadedStyle) {
      console.warn(
        `[ConversionEngine] Cannot bind fontFamily variable - target font "${targetFamily}" not available. ` +
        `Preserving original font family "${style.fontName.family}".`
      );
      // Keep the original font - don't bind the variable
      return;
    }

    // Font loaded successfully - update the style with the style that actually loaded
    // Note: loadedStyle may be a fallback (e.g., "Regular" instead of "Bold")
    style.fontName = { family: targetFamily, style: loadedStyle };

    // Now bind the fontFamily variable
    try {
      style.setBoundVariable('fontFamily', variable);
      console.log(
        `[ConversionEngine] Successfully bound variable ${override.tokenName} to fontFamily ` +
        `(${targetFamily} ${loadedStyle})`
      );
    } catch (error) {
      // This shouldn't happen since we just loaded the font, but handle it gracefully
      console.warn(
        `[ConversionEngine] Unexpected error binding fontFamily variable after loading font:`,
        error
      );
      // Font is already set, just log the error
    }
  }
}

/**
 * Apply font weight override
 */
async function applyFontWeightOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    // Font weight requires changing fontName.style
    const weight = Number(override.value);
    const weightToStyle: Record<number, string> = {
      100: 'Thin',
      200: 'ExtraLight',
      300: 'Light',
      400: 'Regular',
      500: 'Medium',
      600: 'SemiBold',
      700: 'Bold',
      800: 'ExtraBold',
      900: 'Black',
    };

    const newStyle = weightToStyle[weight] || 'Regular';
    const family = style.fontName.family;

    try {
      await figma.loadFontAsync({ family, style: newStyle });
      style.fontName = { family, style: newStyle };
    } catch (error) {
      console.warn(`[ConversionEngine] Failed to load font weight ${weight}:`, error);
      // Keep existing weight on error
    }
  } else {
    // Token binding - Figma doesn't support fontWeight token binding directly
    // We need to apply it as a custom property or skip
    console.warn(
      `[ConversionEngine] Font weight token binding not directly supported, skipping`
    );
  }
}

/**
 * Apply line height override
 */
async function applyLineHeightOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = override.value;
    if (typeof value === 'number') {
      // Assume pixels
      style.lineHeight = { value, unit: 'PIXELS' };
    } else if (typeof value === 'string') {
      // Parse string format like "1.5" or "150%" or "AUTO"
      if (value.toLowerCase() === 'auto') {
        style.lineHeight = { unit: 'AUTO' };
      } else if (value.endsWith('%')) {
        const numValue = parseFloat(value);
        style.lineHeight = { value: numValue, unit: 'PERCENT' };
      } else {
        const numValue = parseFloat(value);
        style.lineHeight = { value: numValue, unit: 'PIXELS' };
      }
    }
  } else {
    // Token binding
    const variable = await figma.variables.getVariableByIdAsync(override.tokenId);
    if (variable) {
      style.setBoundVariable('lineHeight', variable);
    }
  }
}

/**
 * Apply letter spacing override
 */
async function applyLetterSpacingOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = override.value;
    if (typeof value === 'number') {
      // Assume pixels
      style.letterSpacing = { value, unit: 'PIXELS' };
    } else if (typeof value === 'string') {
      // Parse string format like "1.5" or "150%"
      if (value.endsWith('%')) {
        const numValue = parseFloat(value);
        style.letterSpacing = { value: numValue, unit: 'PERCENT' };
      } else {
        const numValue = parseFloat(value);
        style.letterSpacing = { value: numValue, unit: 'PIXELS' };
      }
    }
  } else {
    // Token binding
    const variable = await figma.variables.getVariableByIdAsync(override.tokenId);
    if (variable) {
      style.setBoundVariable('letterSpacing', variable);
    }
  }
}

/**
 * Apply color override
 */
async function applyColorOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    // Parse color string (hex, rgb, etc.)
    const colorValue = String(override.value);
    const color = parseColor(colorValue);
    if (color) {
      style.paints = [{ type: 'SOLID', color, opacity: 1 }];
    }
  } else {
    // Token binding
    const variable = await figma.variables.getVariableByIdAsync(override.tokenId);
    if (variable) {
      style.setBoundVariable('fills', variable);
    }
  }
}

/**
 * Apply text case override
 */
async function applyTextCaseOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = String(override.value).toUpperCase();
    if (['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'].includes(value)) {
      style.textCase = value as TextCase;
    }
  } else {
    console.warn(`[ConversionEngine] Text case token binding not supported, skipping`);
  }
}

/**
 * Apply text decoration override
 */
async function applyTextDecorationOverride(
  style: any, // Figma TextStyle
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = String(override.value).toUpperCase();
    if (['NONE', 'UNDERLINE', 'STRIKETHROUGH'].includes(value)) {
      style.textDecoration = value as TextDecoration;
    }
  } else {
    console.warn(`[ConversionEngine] Text decoration token binding not supported, skipping`);
  }
}

/**
 * Apply a simple property override (fontSize, paragraphSpacing)
 */
async function applyPropertyOverride(
  style: any, // Figma TextStyle
  property: 'fontSize' | 'paragraphSpacing',
  override: PropertyOverrideValue
): Promise<void> {
  if (override.type === 'manual') {
    const value = Number(override.value);
    if (!isNaN(value)) {
      (style as any)[property] = value;
    }
  } else {
    // Token binding
    const variable = await figma.variables.getVariableByIdAsync(override.tokenId);
    if (variable) {
      style.setBoundVariable(property, variable);
    }
  }
}

/**
 * Resolve name conflicts by appending " (Copy)" or " (Copy N)"
 */
function resolveNameConflict(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  // Try " (Copy)" first
  let candidateName = `${baseName} (Copy)`;
  if (!existingNames.has(candidateName)) {
    return candidateName;
  }

  // Try " (Copy N)" with incrementing counter
  let counter = 2;
  while (existingNames.has(`${baseName} (Copy ${counter})`)) {
    counter++;
  }

  return `${baseName} (Copy ${counter})`;
}

/**
 * Parse color string to RGB
 * Supports hex (#RRGGBB, #RGB), rgb(r,g,b), and named colors
 */
function parseColor(colorStr: string): RGB | null {
  // Trim whitespace
  const str = colorStr.trim();

  // Hex format #RRGGBB or #RGB
  if (str.startsWith('#')) {
    const hex = str.substring(1);
    let r: number, g: number, b: number;

    if (hex.length === 3) {
      // Short format #RGB
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
    } else if (hex.length === 6) {
      // Full format #RRGGBB
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
    } else {
      return null;
    }

    return { r, g, b };
  }

  // RGB format rgb(r, g, b)
  const rgbMatch = str.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]) / 255,
      g: parseInt(rgbMatch[2]) / 255,
      b: parseInt(rgbMatch[3]) / 255,
    };
  }

  // Named colors (basic set)
  const namedColors: Record<string, RGB> = {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 1, g: 1, b: 1 },
    red: { r: 1, g: 0, b: 0 },
    green: { r: 0, g: 1, b: 0 },
    blue: { r: 0, g: 0, b: 1 },
  };

  return namedColors[str.toLowerCase()] || null;
}

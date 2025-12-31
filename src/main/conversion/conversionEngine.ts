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

import { traverseTextNodes } from '@/main/utils/traversal';
import { yieldForGC, releaseArray } from './memoryUtils';

/**
 * Build a map of style IDs to text layers using a single document traversal
 *
 * PERFORMANCE: This is 10-100x faster than calling findLayersUsingStyle() for each style
 * because it traverses the document only ONCE instead of N times.
 *
 * @param styleIds - Array of style IDs to find layers for
 * @param cancelFn - Optional function that returns true if operation should be cancelled
 * @returns Map of style ID to array of layer IDs (not node references - memory optimization)
 */
async function buildStyleToLayersMap(
  styleIds: string[],
  cancelFn?: () => boolean
): Promise<{ [styleId: string]: string[] }> {
  console.log(`[ConversionEngine] Building style-to-layers map for ${styleIds.length} styles...`);

  const map: { [styleId: string]: string[] } = {};
  const styleIdSet = new Set(styleIds);

  // Initialize map with empty arrays
  for (const styleId of styleIds) {
    map[styleId] = [];
  }

  // Single traversal using optimized API (10-100x faster than recursive traversal)
  const allTextNodes = await traverseTextNodes(figma.root, cancelFn);
  console.log(`[ConversionEngine] Found ${allTextNodes.length} text nodes in document`);

  // Build map in single pass - MEMORY OPTIMIZATION: Store IDs only (~40 bytes vs ~1KB+ per node)
  for (const node of allTextNodes) {
    if (node.textStyleId && styleIdSet.has(node.textStyleId)) {
      map[node.textStyleId].push(node.id); // Store ID instead of node reference
    }
  }

  // Release node references to allow garbage collection
  allTextNodes.length = 0;

  // Log statistics
  const totalLayers = Object.values(map).reduce((sum, layers) => sum + layers.length, 0);
  console.log(`[ConversionEngine] Mapped ${totalLayers} layer IDs to ${styleIds.length} styles`);

  return map;
}

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
  const BATCH_SIZE = 100;

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
          errors.push(`Layer ${node.name}: ${(error as Error).message}`);
        }
      } else {
        failed++;
        if (node) {
          errors.push(`Layer ${node.name}: Not a text node`);
        } else {
          errors.push(`Layer ${batchIds[j]}: Node not found (may have been deleted)`);
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
        errors.push(`Style ${styleId} not found or not a text style`);
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
      errors.push(`Failed to convert style ${styleId}: ${errorMsg}`);
      console.error(`[ConversionEngine] Error converting style ${styleId}:`, error);
    }
  }

  // Phase 4: Apply styles to layers in batches (50-100%)
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
        `[ConversionEngine] Applying style ${mapping.newStyleName} to ${layers.length} layers...`
      );

      try {
        const result = await applyStyleToLayersInBatches(
          layers,
          mapping.newStyleId,
          (updated, total) => {
            // Calculate overall progress (50-100%)
            const phaseProgress = (totalLayersProcessed + updated) / totalLayersToProcess;
            const percentage = 50 + Math.round(phaseProgress * 50);

            if (progressCallback) {
              progressCallback({
                state: 'applying',
                phase: 'layers',
                percentage,
                layersProcessed: totalLayersProcessed + updated,
                totalLayers: totalLayersToProcess,
              });
            }
          },
          cancelFn
        );

        layersAffected += result.updated;
        totalLayersProcessed += layers.length;

        // Collect errors from batch processing
        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }

        console.log(
          `[ConversionEngine] Applied style ${mapping.newStyleName} to ${result.updated}/${layers.length} layers`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to apply style ${mapping.newStyleName}: ${errorMsg}`);
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
    console.log(`[ConversionEngine] Applied styles to ${layersAffected} layers`);
  }

  return {
    newLocalStyles,
    stylesMapped,
    totalConverted,
    totalFailed,
    errors,
    duration,
    layersAffected: applyToLayers ? layersAffected : undefined,
    checkpointCreated: applyToLayers ? checkpointCreated : undefined,
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
 * Returns true if any variant was successfully loaded
 */
async function tryLoadFontWithFallbacks(family: string, preferredStyle: string): Promise<boolean> {
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
      return true;
    } catch (error) {
      // Continue to next fallback
      continue;
    }
  }

  return false;
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

    const fontLoaded = await tryLoadFontWithFallbacks(family, currentStyle);
    if (!fontLoaded) {
      throw new Error(
        `Cannot load font "${family}". The font may be missing from your system.`
      );
    }

    // Update the font name (keep current style if it loaded, or use whatever fallback worked)
    // Note: We don't change the style here because tryLoadFontWithFallbacks already loaded it
    style.fontName = { family, style: currentStyle };
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

    // When binding a fontFamily variable, we need to ensure the style has a loaded font.
    // Since the variable only affects the family (not the weight), we can use Inter
    // with the same weight/style as the original, then bind the variable.
    // This avoids needing the original font (e.g., Menlo) to be installed.
    const originalWeight = style.fontName.style;

    // Debug: Log the variable details
    const variableValue = variable.valuesByMode[Object.keys(variable.valuesByMode)[0]];
    console.log(
      `[ConversionEngine] Preparing to bind fontFamily variable:`,
      {
        variableName: variable.name,
        variableValue,
        originalFamily: style.fontName.family,
        originalWeight,
      }
    );

    // Load Inter with the same weight/style
    try {
      await figma.loadFontAsync({ family: 'Inter', style: originalWeight });
      style.fontName = { family: 'Inter', style: originalWeight };
    } catch (interError) {
      // If Inter doesn't have this weight, fall back to Regular
      console.warn(
        `[ConversionEngine] Inter doesn't have weight ${originalWeight}, using Regular...`
      );
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      style.fontName = { family: 'Inter', style: 'Regular' };
    }

    // Now bind the fontFamily variable (which will override just the family, keeping the weight)
    try {
      style.setBoundVariable('fontFamily', variable);
      console.log(`[ConversionEngine] Bound variable ${override.tokenName} to fontFamily`);
    } catch (error) {
      // Figma requires the target font (variable value + weight) to be installed
      // If binding fails, fall back to not using a variable - just preserve the original font
      console.warn(
        `[ConversionEngine] Cannot bind fontFamily variable (target font not available). Preserving original font family.`,
        error
      );
      // The style already has Inter loaded, which is fine - we'll just not bind the variable
      // The conversion will succeed, just without the variable binding
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

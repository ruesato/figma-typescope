import type {
  TextLayer,
  TextStyle,
  DesignToken,
  LibrarySource,
  StyleHierarchyNode,
  AuditMetrics,
  StyleGovernanceAuditResult,
  RGBA,
  LineHeight,
  LetterSpacing,
  TokenBinding,
} from '@/shared/types';

import { detectStyleAssignment } from '@/main/utils/styleDetection';
import { getAvailableStyles } from '@/main/utils/styleLibrary';
import { getAllDocumentTokens, integrateTokenUsageIntoLayers } from '@/main/utils/tokenDetection';

/**
 * Metadata Processor for Style Governance Audit
 *
 * Processes raw scan results and extracts complete style and token metadata.
 * Simplified implementation to avoid conflicts.
 */

export interface ProcessorInput {
  textLayers: any[]; // Raw output from scanner
  totalPages: number;
  options: {
    includeHiddenLayers?: boolean;
    includeTokens?: boolean;
  };
}

export interface ProcessorOutput {
  layers: TextLayer[];
  styles: TextStyle[];
  tokens: DesignToken[];
  libraries: LibrarySource[];
  styleHierarchy: StyleHierarchyNode[];
  metrics: AuditMetrics;
  styledLayers: TextLayer[];
  unstyledLayers: TextLayer[];
}

/**
 * Process scan results and build complete audit result
 *
 * @param input - Raw scan data and processing options
 * @param isCancelled - Callback to check if processing should be cancelled
 * @param onProgress - Optional callback to report progress
 * @returns Complete processed data for audit result
 */
export async function processAuditData(
  input: ProcessorInput,
  isCancelled?: () => boolean,
  onProgress?: (progress: number, message: string) => void
): Promise<ProcessorOutput> {
  const { textLayers, options } = input;

  const output: ProcessorOutput = {
    layers: [],
    styles: [],
    tokens: [],
    libraries: [],
    styleHierarchy: [],
    metrics: {} as AuditMetrics,
    styledLayers: [],
    unstyledLayers: [],
  };

  try {
    console.log(`Processing ${textLayers.length} text layers...`);

    // Progress: 40-95% (Processing phase)

    // Step 1: Collect all unique style IDs used in the document (40-45%)
    if (onProgress) onProgress(42, 'Collecting style IDs...');

    const usedStyleIds = new Set<string>();
    for (const layer of textLayers) {
      // Scanner stores style ID as 'textStyleId'
      const styleId = layer.textStyleId || layer.styleId;
      if (styleId && typeof styleId === 'string') {
        usedStyleIds.add(styleId);
      }
    }
    console.log(
      `Found ${usedStyleIds.size} unique styles in use (from ${textLayers.length} layers)`
    );

    // Step 2: Fetch metadata for all used styles (45-55%)
    if (onProgress) onProgress(45, 'Extracting text styles...');

    const styles: TextStyle[] = [];
    const libraryMap = await buildLibraryMap(); // Map library keys to names
    console.log(`Library map has ${libraryMap.size} entries`);

    let localCount = 0;
    let remoteCount = 0;
    let failedCount = 0;
    const totalStyles = usedStyleIds.size;
    let processedStyles = 0;

    for (const styleId of usedStyleIds) {
      try {
        const figmaStyle = await figma.getStyleByIdAsync(styleId);
        if (figmaStyle && figmaStyle.type === 'TEXT') {
          const textStyle = await convertFigmaStyleToTextStyle(figmaStyle, libraryMap);
          styles.push(textStyle);

          if (figmaStyle.remote) {
            remoteCount++;
            console.log(`Found remote style: ${figmaStyle.name} (key: ${figmaStyle.key})`);
          } else {
            localCount++;
          }
        }
      } catch (error) {
        failedCount++;
        console.warn(`Could not load style ${styleId}:`, error);
      }

      // Update progress every 5 styles or on last style
      processedStyles++;
      if (onProgress && (processedStyles % 5 === 0 || processedStyles === totalStyles)) {
        const progress = 45 + Math.round((processedStyles / totalStyles) * 10);
        onProgress(progress, `Loading style ${processedStyles} of ${totalStyles}...`);
      }
    }
    console.log(
      `Loaded ${styles.length} styles: ${localCount} local, ${remoteCount} remote, ${failedCount} failed`
    );
    output.styles = styles;

    // Step 3: Build library sources (55-60%)
    if (onProgress) onProgress(57, 'Resolving library sources...');
    output.libraries = buildLibrarySources(styles);

    // Step 4: Get all available tokens (60-65%)
    if (options.includeTokens) {
      if (onProgress) onProgress(62, 'Detecting design tokens...');
      console.log('Detecting design tokens...');
      try {
        const allTokens = await getAllDocumentTokens();
        output.tokens = allTokens;
        console.log(`Found ${allTokens.length} design tokens`);
        if (onProgress) onProgress(65, `Found ${allTokens.length} design token${allTokens.length !== 1 ? 's' : ''}`);
      } catch (error) {
        console.warn('Error detecting tokens:', error);
        output.tokens = [];
      }
    } else {
      if (onProgress) onProgress(65, 'Skipping token detection...');
    }

    // Step 5: Process each text layer in batches (65-85%)
    if (onProgress) onProgress(67, 'Processing text layers...');

    const BATCH_SIZE = 100; // Process 100 layers at a time
    let processedLayers = 0;
    const totalLayers = textLayers.length;

    for (let i = 0; i < textLayers.length; i += BATCH_SIZE) {
      // Check for cancellation
      if (isCancelled && isCancelled()) {
        throw new Error('Processing cancelled by user');
      }

      const batch = textLayers.slice(i, Math.min(i + BATCH_SIZE, textLayers.length));

      // Process batch in parallel
      const batchResults = await Promise.all(batch.map((layer) => processTextLayer(layer, styles)));

      output.layers.push(...batchResults);
      processedLayers += batchResults.length;

      // Update progress
      if (onProgress) {
        const progress = 67 + Math.round((processedLayers / totalLayers) * 18); // 67-85%
        onProgress(progress, `Processed ${processedLayers} of ${totalLayers} layer${totalLayers !== 1 ? 's' : ''}...`);
      }

      // Yield to the event loop to prevent blocking
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Step 6: Integrate token usage into layers and styles (85-88%)
    if (options.includeTokens && output.tokens.length > 0) {
      if (onProgress) onProgress(85, 'Integrating token usage...');
      await integrateTokenUsageIntoLayers(output.layers, output.tokens);

      // Also integrate tokens into styles
      await integrateTokenUsageIntoStyles(output.styles, output.tokens);
    }

    // Step 7: Categorize layers (88-90%)
    if (onProgress) onProgress(88, 'Categorizing layers...');
    const { styled, unstyled } = categorizeLayers(output.layers);
    output.styledLayers = styled;
    output.unstyledLayers = unstyled;

    // Step 8: Build hierarchy (90-93%)
    if (onProgress) onProgress(90, 'Building style hierarchy...');
    output.styleHierarchy = buildSimpleHierarchy(output.styles);

    // Step 9: Calculate metrics (93-95%)
    if (onProgress) onProgress(93, 'Calculating metrics...');
    output.metrics = calculateAuditMetrics(output.layers, output.styles, output.tokens);

    if (onProgress) onProgress(95, 'Finalizing audit results...');

    console.log(
      `Processing complete: ${output.layers.length} layers, ${output.styles.length} styles`
    );

    return output;
  } catch (error) {
    throw error;
  }
}

/**
 * Process a single text layer with complete metadata extraction
 *
 * @param rawLayer - Raw layer data from scan
 * @param allStyles - All available styles in document (for override calculation)
 * @returns Processed TextLayer with full metadata
 */
async function processTextLayer(rawLayer: any, allStyles: TextStyle[]): Promise<TextLayer> {
  // Get the actual Figma node for detailed analysis
  const textNode = await figma.getNodeByIdAsync(rawLayer.id);
  if (!textNode) {
    throw new Error(`Text node not found: ${rawLayer.id}`);
  }

  // Detect style assignment
  const styleAssignment = await detectStyleAssignment(textNode);

  // Extract font properties from text node (Phase 3: Complete property extraction)
  let fontFamily = undefined;
  let fontSize = undefined;
  let fontWeight = undefined;
  let lineHeight = undefined;
  let letterSpacing = undefined;
  let fills = undefined;

  if (textNode.type === 'TEXT' && textNode.characters.length > 0) {
    try {
      // Extract font name (family)
      const fontName = textNode.getRangeFontName(0, 1);
      if (fontName !== figma.mixed) {
        fontFamily = fontName.family;
      }

      // Extract font size
      const rawFontSize = textNode.getRangeFontSize(0, 1);
      if (rawFontSize !== figma.mixed && typeof rawFontSize === 'number') {
        fontSize = rawFontSize;
      }

      // Extract font weight
      const rawFontWeight = textNode.getRangeFontWeight(0, 1);
      if (rawFontWeight !== figma.mixed && typeof rawFontWeight === 'number') {
        fontWeight = rawFontWeight;
      }

      // Extract line height
      const rawLineHeight = textNode.getRangeLineHeight(0, 1);
      if (rawLineHeight !== figma.mixed) {
        lineHeight = extractLineHeight(rawLineHeight);
      }

      // Extract letter spacing
      const rawLetterSpacing = textNode.getRangeLetterSpacing(0, 1);
      if (rawLetterSpacing !== figma.mixed) {
        letterSpacing = extractLetterSpacing(rawLetterSpacing);
      }

      // Extract fills (color)
      const rawFills = textNode.getRangeFills(0, 1);
      if (rawFills !== figma.mixed && Array.isArray(rawFills)) {
        fills = extractFills(rawFills);
      }

      // DEBUG: Log extracted properties for verification (first 3 layers)
      if (Math.random() < 0.05) { // Log ~5% of layers
        console.log(`[DEBUG] Layer "${textNode.name}":`, {
          fontFamily,
          fontSize,
          fontWeight,
          lineHeight,
          letterSpacing,
          fillCount: fills?.length || 0,
        });
      }
    } catch (error) {
      console.warn(`Failed to extract font properties for layer ${textNode.name}:`, error);
    }
  }

  // Build TextLayer entity
  const textLayer: TextLayer = {
    // Identity
    id: rawLayer.id,
    name: rawLayer.name,

    // Content
    textContent: rawLayer.textContent,
    characters: rawLayer.characters,

    // Location
    pageId: rawLayer.pageId,
    pageName: rawLayer.pageName,
    parentType: rawLayer.parentType,
    componentPath: rawLayer.componentPath,

    // Style Assignment
    assignmentStatus: styleAssignment.assignmentStatus,
    styleId: styleAssignment.styleId,
    styleName: styleAssignment.styleName,
    styleSource: styleAssignment.libraryName,

    // Token Usage (placeholder for now)
    tokens: [],

    // Visual Properties
    visible: rawLayer.visible,
    opacity: rawLayer.opacity,

    // Override Status
    hasOverrides: styleAssignment.assignmentStatus === 'partially-styled',
    overriddenProperties: [], // DEPRECATED

    // Font Properties (Phase 3: Complete property extraction)
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    fills,
  };

  // Calculate property overrides (Phase 4)
  // Compare layer properties vs style base properties
  if (textLayer.styleId && allStyles.length > 0) {
    const style = allStyles.find((s) => s.id === textLayer.styleId);
    if (style) {
      const overrides = calculatePropertyOverrides(textLayer, style);
      if (overrides.length > 0) {
        textLayer.propertyOverrides = overrides;
        textLayer.hasOverrides = true;
      }
    }
  }

  return textLayer;
}

/**
 * Convert style summaries to TextStyle entities
 *
 * @param summaries - Style summaries from getAvailableStyles
 * @returns TextStyle entities
 */
function convertSummariesToStyles(summaries: any[]): TextStyle[] {
  return summaries.map((summary) => ({
    id: summary.id,
    name: summary.name,
    key: summary.key || summary.id,

    hierarchyPath: parseStyleHierarchy(summary.name),
    parentStyleId: undefined,
    childStyleIds: [],

    sourceType: summary.isRemote ? 'team_library' : 'local',
    libraryName: summary.libraryName,
    libraryId: summary.libraryId || 'local',

    usageCount: 0, // Will be calculated later
    pageDistribution: [],
    componentUsage: {
      mainComponentCount: 0,
      instanceCount: 0,
      plainLayerCount: 0,
      overrideCount: 0,
    },

    isDeprecated: false,
    lastModified: undefined,
  }));
}

/**
 * Parse style hierarchy from style name
 *
 * @param styleName - Style name (e.g., "Typography/Heading/H1")
 * @returns Hierarchy path components
 */
function parseStyleHierarchy(styleName: string): string[] {
  return styleName.split('/').map((part) => part.trim());
}

/**
 * Categorize layers by style assignment status
 *
 * @param layers - All processed text layers
 * @returns Categorized layers (styled vs unstyled)
 */
function categorizeLayers(layers: TextLayer[]): {
  styled: TextLayer[];
  unstyled: TextLayer[];
} {
  const styled: TextLayer[] = [];
  const unstyled: TextLayer[] = [];

  for (const layer of layers) {
    if (layer.assignmentStatus === 'unstyled') {
      unstyled.push(layer);
    } else {
      styled.push(layer);
    }
  }

  return { styled, unstyled };
}

/**
 * Build simple style hierarchy
 *
 * @param styles - All text styles
 * @returns Simple hierarchy tree
 */
function buildSimpleHierarchy(styles: TextStyle[]): StyleHierarchyNode[] {
  const hierarchyMap = new Map<string, StyleHierarchyNode>();

  // Create nodes for each style
  for (const style of styles) {
    const path = style.hierarchyPath;
    const fullName = path.join('/');

    const node: StyleHierarchyNode = {
      styleName: fullName,
      styleId: style.id,
      parentName: path.length > 1 ? path.slice(0, -1)[0] : undefined,
      children: [],
      usageCount: style.usageCount,
    };

    hierarchyMap.set(fullName, node);
  }

  // Build tree structure
  const rootNodes: StyleHierarchyNode[] = [];
  for (const [, node] of hierarchyMap) {
    if (node.parentName && hierarchyMap.has(node.parentName)) {
      hierarchyMap.get(node.parentName)!.children.push(node);
    } else if (!node.parentName) {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

/**
 * Calculate audit metrics
 *
 * @param layers - All processed text layers
 * @param styles - All text styles
 * @param tokens - All detected design tokens
 * @returns Complete audit metrics
 */
function calculateAuditMetrics(
  layers: TextLayer[],
  styles: TextStyle[],
  _tokens: DesignToken[] = []
): AuditMetrics {
  // Style metrics
  const styledCount = layers.filter((l) => l.assignmentStatus !== 'unstyled').length;
  const unstyledCount = layers.filter((l) => l.assignmentStatus === 'unstyled').length;
  const partiallyStyledCount = layers.filter(
    (l) => l.assignmentStatus === 'partially-styled'
  ).length;
  const fullyStyledCount = styledCount - partiallyStyledCount;
  const styleAdoptionRate = layers.length > 0 ? Math.round((styledCount / layers.length) * 100) : 0;

  // Token properties that can be bound
  const TOKEN_PROPERTIES = ['fills', 'fontFamily', 'fontSize', 'lineHeight', 'letterSpacing'];
  const TOTAL_TOKEN_PROPERTIES = TOKEN_PROPERTIES.length; // 5

  // Categorize layers by token coverage level
  const fullTokenCoverageLayers: TextLayer[] = [];
  const partialTokenCoverageLayers: TextLayer[] = [];
  const noTokenCoverageLayers: TextLayer[] = [];

  for (const layer of layers) {
    // Count unique properties that have tokens (not total bindings)
    const uniqueProperties = new Set(layer.tokens?.map((t) => t.property) || []);
    const propertyCount = uniqueProperties.size;

    // Debug first 3 layers
    if (layers.indexOf(layer) < 3) {
      console.log(`[TokenCoverage] Layer "${layer.name}":`, {
        tokenBindings: layer.tokens?.length || 0,
        properties: Array.from(uniqueProperties),
        propertyCount,
      });
    }

    if (propertyCount === 0) {
      noTokenCoverageLayers.push(layer);
    } else if (propertyCount >= TOTAL_TOKEN_PROPERTIES) {
      // Has all 5 properties using tokens = full coverage
      fullTokenCoverageLayers.push(layer);
    } else {
      // Has 1-4 properties using tokens = partial coverage
      partialTokenCoverageLayers.push(layer);
    }
  }

  // Coverage counts and rates
  const fullTokenCoverageCount = fullTokenCoverageLayers.length;
  const fullTokenCoverageRate =
    layers.length > 0 ? Math.round((fullTokenCoverageCount / layers.length) * 100) : 0;

  const partialTokenCoverageCount = partialTokenCoverageLayers.length;
  const partialTokenCoverageRate =
    layers.length > 0 ? Math.round((partialTokenCoverageCount / layers.length) * 100) : 0;

  const noTokenCoverageCount = noTokenCoverageLayers.length;
  const noTokenCoverageRate =
    layers.length > 0 ? Math.round((noTokenCoverageCount / layers.length) * 100) : 0;

  // Debug logging
  console.log('[TokenCoverage] Breakdown:', {
    total: layers.length,
    full: fullTokenCoverageCount,
    partial: partialTokenCoverageCount,
    none: noTokenCoverageCount,
    sum: fullTokenCoverageCount + partialTokenCoverageCount + noTokenCoverageCount,
  });

  // Legacy token metrics (kept for backward compatibility)
  const layersUsingTokens = fullTokenCoverageCount + partialTokenCoverageCount;
  const layersWithBothStylesAndTokens = layers.filter(
    (l) => l.assignmentStatus !== 'unstyled' && l.tokens && l.tokens.length > 0
  ).length;
  const totalTokenUsages = layers.reduce((sum, l) => sum + (l.tokens?.length || 0), 0);

  // Element counts (legacy)
  const elementCount = layers.length;
  const elementsWithTokens = layersUsingTokens;
  const elementsWithoutTokens = elementCount - elementsWithTokens;

  // Token Adoption Rate: % of layers using tokens (at least 1)
  const tokenAdoptionRate =
    layers.length > 0 ? Math.round((layersUsingTokens / layers.length) * 100) : 0;

  // Token Coverage Rate: % of tokens that are actually used
  const usedTokenIds = new Set<string>();
  for (const layer of layers) {
    if (layer.tokens) {
      for (const binding of layer.tokens) {
        usedTokenIds.add(binding.tokenId);
      }
    }
  }
  const tokenCoverageRate =
    _tokens.length > 0 ? Math.round((usedTokenIds.size / _tokens.length) * 100) : 0;

  // Token inventory metrics
  const totalTokenCount = _tokens.length;
  const uniqueTokensUsed = usedTokenIds.size;
  const unusedTokenCount = totalTokenCount - uniqueTokensUsed;
  const totalTokenBindings = totalTokenUsages;

  // Group tokens by collection
  const tokensByCollection: Record<string, number> = {};
  for (const token of _tokens) {
    const collectionName = token.collectionName || 'Unknown';
    tokensByCollection[collectionName] = (tokensByCollection[collectionName] || 0) + 1;
  }

  // Calculate top styles by usage (from layer assignments)
  const styleUsageMap = new Map<string, number>();
  for (const layer of layers) {
    if (layer.styleId) {
      styleUsageMap.set(layer.styleId, (styleUsageMap.get(layer.styleId) || 0) + 1);
    }
  }
  const topStyles = Array.from(styleUsageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([styleId, usageCount]) => {
      // Find the style name from the styles array
      const style = styles.find((s) => s.id === styleId);
      return {
        styleId,
        styleName: style?.name || 'Unknown',
        usageCount,
      };
    });

  return {
    styleAdoptionRate,
    fullyStyledCount,
    partiallyStyledCount,
    unstyledCount,
    libraryDistribution: { Local: styledCount }, // Simplified
    tokenAdoptionRate,
    tokenCoverageRate,
    totalTokenCount,
    uniqueTokensUsed,
    unusedTokenCount,
    totalTokenBindings,
    tokensByCollection,
    elementCount,
    elementsWithTokens,
    elementsWithoutTokens,
    fullTokenCoverageCount,
    fullTokenCoverageRate,
    partialTokenCoverageCount,
    partialTokenCoverageRate,
    noTokenCoverageCount,
    noTokenCoverageRate,
    tokenUsageCount: totalTokenUsages,
    mixedUsageCount: layersWithBothStylesAndTokens,
    topStyles,
    deprecatedStyleCount: 0,
  };
}

/**
 * Build a map of library keys to library names
 *
 * @returns Map of library key to library name
 */
async function buildLibraryMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  try {
    // Note: teamLibrary API may not be available in all contexts
    // If unavailable, we'll fall back to basic library name resolution
    if (figma.teamLibrary && typeof figma.teamLibrary.getAvailableLibrariesAsync === 'function') {
      const libraries = await figma.teamLibrary.getAvailableLibrariesAsync();
      for (const library of libraries) {
        map.set(library.key, library.name);
      }
    } else {
      console.warn('teamLibrary API not available');
    }
  } catch (error) {
    console.warn('Could not load team libraries - proceeding with basic name resolution:', error);
  }

  return map;
}

/**
 * Convert Figma TextStyle to our TextStyle entity with library resolution
 *
 * @param figmaStyle - Figma text style object
 * @param libraryMap - Map of library keys to names
 * @returns TextStyle entity
 */
async function convertFigmaStyleToTextStyle(
  figmaStyle: any, // Figma's TextStyle type (has remote, key properties)
  libraryMap: Map<string, string>
): Promise<TextStyle> {
  // Our TextStyle entity type
  let sourceType: 'local' | 'team_library' = 'local';
  let libraryName = 'Local';
  let libraryId = 'local';

  // Resolve library information for remote styles
  if (figmaStyle.remote) {
    sourceType = 'team_library';

    // Extract library key from style key (format: "libraryKey/styleKey")
    const keyParts = figmaStyle.key.split('/');
    if (keyParts.length >= 2) {
      const libraryKey = keyParts[0];
      libraryName = libraryMap.get(libraryKey) || `Library (${libraryKey.substring(0, 8)}...)`;
      libraryId = libraryKey;
    } else {
      libraryName = 'External Library';
      libraryId = 'external';
    }
  }

  // Extract base font properties from style (Phase 4)
  // Note: TextStyle properties are accessed directly, not via range methods
  const fontFamily = figmaStyle.fontName?.family || 'Unknown';
  const fontSize = figmaStyle.fontSize || 16;
  const fontWeight = figmaStyle.fontName?.style ? parseFontWeight(figmaStyle.fontName.style) : 400;
  const lineHeight = figmaStyle.lineHeight ? extractLineHeight(figmaStyle.lineHeight) : { unit: 'AUTO' as const };
  const letterSpacing = figmaStyle.letterSpacing ? extractLetterSpacing(figmaStyle.letterSpacing) : { unit: 'PIXELS' as const, value: 0 };

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

    sourceType,
    libraryName,
    libraryId,

    usageCount: 0, // Will be calculated later
    pageDistribution: [],
    componentUsage: {
      mainComponentCount: 0,
      instanceCount: 0,
      plainLayerCount: 0,
      overrideCount: 0,
    },

    isDeprecated: false,
    lastModified: undefined,

    // Base Properties (Phase 4)
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    fills,

    // Token Bindings (will be populated later if token detection is enabled)
    tokens: [],
  };
}

/**
 * Build LibrarySource objects from detected styles
 *
 * @param styles - All text styles (local + remote)
 * @returns Array of LibrarySource objects, one per library
 */
function buildLibrarySources(styles: TextStyle[]): LibrarySource[] {
  // Group styles by library
  const stylesByLibrary = new Map<string, TextStyle[]>();

  for (const style of styles) {
    const libraryKey = style.libraryId || 'local';
    if (!stylesByLibrary.has(libraryKey)) {
      stylesByLibrary.set(libraryKey, []);
    }
    stylesByLibrary.get(libraryKey)!.push(style);
  }

  // Create LibrarySource for each library
  const libraries: LibrarySource[] = [];

  for (const [libraryId, libraryStyles] of stylesByLibrary) {
    const isLocal = libraryId === 'local';
    const libraryName = libraryStyles[0]?.libraryName || 'Unknown';

    libraries.push({
      id: libraryId,
      name: libraryName,
      type: isLocal ? 'local' : 'team_library',
      isEnabled: true,
      isAvailable: true,
      styleCount: libraryStyles.length,
      styleIds: libraryStyles.map((s) => s.id),
      totalUsageCount: 0, // Will be calculated from layer counts
      usagePercentage: 0,
    });
  }

  // Sort: Local first, then alphabetically
  return libraries.sort((a, b) => {
    if (a.type === 'local') return -1;
    if (b.type === 'local') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Build complete audit result from processed data
 *
 * @param processed - Processed output from processAuditData
 * @param documentInfo - Document metadata
 * @param duration - Audit duration in milliseconds
 * @returns Complete StyleGovernanceAuditResult
 */
export function createAuditResult(
  processed: ProcessorOutput,
  documentInfo: {
    documentName: string;
    documentId: string;
    totalPages: number;
  },
  duration: number
): StyleGovernanceAuditResult {
  return {
    // Metadata
    timestamp: new Date(),
    documentName: documentInfo.documentName,
    documentId: documentInfo.documentId,

    // Scope
    totalPages: documentInfo.totalPages,
    totalTextLayers: processed.layers.length,

    // Inventories
    styles: processed.styles,
    tokens: processed.tokens,
    layers: processed.layers,
    libraries: processed.libraries,

    // Hierarchy
    styleHierarchy: processed.styleHierarchy,

    // Categorization
    styledLayers: processed.styledLayers,
    unstyledLayers: processed.unstyledLayers,

    // Analytics
    metrics: processed.metrics,

    // Status
    isStale: false,
    auditDuration: duration,
  };
}

// ============================================================================
// Font Property Extraction Helpers (Phase 3)
// ============================================================================

/**
 * Extract and normalize line height from Figma's LineHeight type
 *
 * @param lineHeight - Figma's LineHeight object
 * @returns Normalized LineHeight for our data model
 */
function extractLineHeight(lineHeight: any): any {
  // Handle symbol type (AUTO)
  if (typeof lineHeight === 'symbol') {
    return { unit: 'AUTO' };
  }

  // Handle object with unit property
  if (typeof lineHeight === 'object' && lineHeight !== null && 'unit' in lineHeight) {
    if (lineHeight.unit === 'AUTO') {
      return { unit: 'AUTO' };
    }
    if ('value' in lineHeight) {
      return {
        unit: lineHeight.unit,
        value: lineHeight.value,
      };
    }
  }

  // Fallback to AUTO
  return { unit: 'AUTO' };
}

/**
 * Extract and normalize letter spacing from Figma's LetterSpacing type
 *
 * @param letterSpacing - Figma's LetterSpacing object
 * @returns Normalized LetterSpacing for our data model
 */
function extractLetterSpacing(letterSpacing: any): any {
  if (typeof letterSpacing === 'object' && letterSpacing !== null) {
    if ('unit' in letterSpacing && 'value' in letterSpacing) {
      return {
        unit: letterSpacing.unit,
        value: letterSpacing.value,
      };
    }
  }

  // Fallback to 0 pixels
  return { unit: 'PIXELS', value: 0 };
}

/**
 * Extract fill colors from Figma's Paint array
 * Extracts solid fills and converts to RGBA format
 *
 * @param fills - Figma's Paint array
 * @returns Array of RGBA colors (only solid fills)
 */
function extractFills(fills: readonly Paint[]): any[] {
  const colors: any[] = [];

  for (const fill of fills) {
    if (fill.type === 'SOLID' && fill.visible !== false) {
      colors.push({
        r: fill.color.r,
        g: fill.color.g,
        b: fill.color.b,
        a: fill.opacity ?? 1,
      });
    }
  }

  return colors;
}

/**
 * Parse font weight from font style name
 * Converts font style strings (e.g., "Regular", "Bold", "Light") to numeric weights
 *
 * @param style - Font style name from Figma (e.g., "Regular", "Bold", "Semi Bold")
 * @returns Numeric font weight (100-900)
 */
function parseFontWeight(style: string): number {
  const styleLower = style.toLowerCase();

  // Common mappings
  if (styleLower.includes('thin')) return 100;
  if (styleLower.includes('extra light') || styleLower.includes('ultralight')) return 200;
  if (styleLower.includes('light')) return 300;
  if (styleLower.includes('regular') || styleLower.includes('normal') || styleLower.includes('book')) return 400;
  if (styleLower.includes('medium')) return 500;
  if (styleLower.includes('semi bold') || styleLower.includes('semibold') || styleLower.includes('demi bold')) return 600;
  if (styleLower.includes('bold')) return 700;
  if (styleLower.includes('extra bold') || styleLower.includes('ultrabold')) return 800;
  if (styleLower.includes('black') || styleLower.includes('heavy')) return 900;

  // Default to regular
  return 400;
}

/**
 * Integrate token usage into styles (Phase 6.1 - Bug fix)
 * Detects token bindings on text styles and populates style.tokens array
 *
 * @param styles - Array of TextStyle objects to populate with tokens
 * @param tokens - All available design tokens (for tokenMap)
 */
async function integrateTokenUsageIntoStyles(
  styles: TextStyle[],
  tokens: DesignToken[]
): Promise<void> {
  console.log(`[TokenIntegration] Integrating tokens into ${styles.length} styles...`);
  console.log(`[TokenIntegration] Available tokens: ${tokens.length}`);

  // Build token map for quick lookup
  const tokenMap = new Map<string, DesignToken>();
  for (const token of tokens) {
    tokenMap.set(token.id, token);
  }
  console.log(`[TokenIntegration] Token IDs in map:`, Array.from(tokenMap.keys()));

  // Process each style
  let stylesWithTokens = 0;
  let stylesWithoutBoundVariables = 0;
  for (const style of styles) {
    try {
      // Fetch the actual Figma style object to access boundVariables
      const figmaStyle = await figma.getStyleByIdAsync(style.id);
      if (!figmaStyle || figmaStyle.type !== 'TEXT') {
        console.log(`[TokenIntegration] Style "${style.name}": Not a text style or not found`);
        continue;
      }

      // Check if style has bound variables
      if (!figmaStyle.boundVariables) {
        console.log(`[TokenIntegration] Style "${style.name}": No boundVariables`);
        stylesWithoutBoundVariables++;
        continue;
      }

      console.log(`[TokenIntegration] Style "${style.name}": Has boundVariables`, figmaStyle.boundVariables);

      // Extract token bindings from the style
      const bindings: TokenBinding[] = [];
      for (const [propertyName, variableBindings] of Object.entries(figmaStyle.boundVariables)) {
        const bindingsArray = Array.isArray(variableBindings)
          ? variableBindings
          : [variableBindings];

        for (const binding of bindingsArray) {
          if (binding && typeof binding === 'object' && 'id' in binding) {
            const bindingId = binding.id;
            console.log(`[TokenIntegration] Style "${style.name}": Property "${propertyName}" bound to variable ID: ${bindingId}`);
            let token = tokenMap.get(bindingId);

            // If not in local token map, try fetching from remote library
            if (!token) {
              console.log(`[TokenIntegration] Style "${style.name}": Not in local map, fetching remote variable...`);
              try {
                const variable = await figma.variables.getVariableByIdAsync(bindingId);
                if (variable) {
                  console.log(`[TokenIntegration] Style "${style.name}": Found remote variable "${variable.name}"`);

                  // Get token type from variable.resolvedType
                  const getTokenType = (v: any): 'color' | 'number' | 'string' | 'boolean' => {
                    if (!v.resolvedType) return 'string';
                    const type = v.resolvedType.toLowerCase();
                    return type === 'color' ? 'color' :
                      type === 'float' || type === 'number' ? 'number' :
                      type === 'boolean' ? 'boolean' : 'string';
                  };

                  // Get first mode value
                  const firstModeId = Object.keys(variable.valuesByMode)[0];
                  const firstValue = variable.valuesByMode[firstModeId];
                  const tokenType = getTokenType(variable);

                  // Create a token object from the remote variable
                  const remoteToken: DesignToken = {
                    id: variable.id,
                    name: variable.name,
                    key: `remote/${variable.id}`,
                    type: tokenType,
                    resolvedType: tokenType,
                    currentValue: firstValue,
                    value: firstValue,
                    collectionId: variable.variableCollectionId,
                    collectionName: 'Remote Library',
                    collections: ['Remote Library'],
                    modeId: firstModeId,
                    modeName: 'Default',
                    valuesByMode: variable.valuesByMode || { [firstModeId]: firstValue },
                    modes: {},
                    isAlias: false,
                    usageCount: 0,
                    layerIds: [],
                    propertyTypes: [],
                  };

                  // Add to token map for future lookups
                  tokenMap.set(variable.id, remoteToken);
                  token = remoteToken;
                }
              } catch (error) {
                console.warn(`[TokenIntegration] Failed to fetch remote variable ${bindingId}:`, error);
              }
            }

            if (token) {
              console.log(`[TokenIntegration] Style "${style.name}": Found matching token "${token.name}"`);
              bindings.push({
                property: propertyName as
                  | 'fills'
                  | 'fontFamily'
                  | 'fontSize'
                  | 'lineHeight'
                  | 'letterSpacing',
                tokenId: token.id,
                tokenName: token.name,
                tokenValue: token.value,
              });
            } else {
              console.log(`[TokenIntegration] Style "${style.name}": No matching token found for variable ID: ${bindingId}`);
            }
          }
        }
      }

      // Update style with token bindings
      if (bindings.length > 0) {
        style.tokens = bindings;
        stylesWithTokens++;
        console.log(`[TokenIntegration] Style "${style.name}": Added ${bindings.length} token bindings`);
      }
    } catch (error) {
      console.warn(`Failed to integrate tokens for style ${style.name}:`, error);
    }
  }

  console.log(`[TokenIntegration] Summary:`);
  console.log(`  - Styles processed: ${styles.length}`);
  console.log(`  - Styles without boundVariables: ${stylesWithoutBoundVariables}`);
  console.log(`  - Styles with tokens: ${stylesWithTokens}`);
}

/**
 * Calculate property overrides by comparing layer vs style properties
 * Returns array of PropertyOverride objects for properties that differ
 *
 * @param layer - TextLayer with extracted font properties
 * @param style - TextStyle with base properties
 * @returns Array of PropertyOverride objects (empty if no overrides)
 */
function calculatePropertyOverrides(layer: any, style: any): any[] {
  const overrides: any[] = [];

  // Helper to format values for display
  const formatValue = (property: string, value: any): string => {
    switch (property) {
      case 'fontFamily':
        return value || 'Unknown';
      case 'fontSize':
        return `${value}px`;
      case 'fontWeight':
        return String(value);
      case 'lineHeight':
        if (!value) return 'AUTO';
        if (value.unit === 'AUTO') return 'AUTO';
        return value.unit === 'PERCENT' ? `${value.value}%` : `${value.value}px`;
      case 'letterSpacing':
        if (!value) return '0px';
        return value.unit === 'PERCENT' ? `${value.value}%` : `${value.value}px`;
      case 'fills':
        if (!value || !Array.isArray(value) || value.length === 0) return 'No fill';
        const fill = value[0];
        return `rgba(${Math.round(fill.r * 255)}, ${Math.round(fill.g * 255)}, ${Math.round(fill.b * 255)}, ${fill.a})`;
      default:
        return String(value);
    }
  };

  // Helper to compare values (handles different types)
  const valuesEqual = (prop: string, val1: any, val2: any): boolean => {
    if (val1 === undefined || val2 === undefined) return false;

    switch (prop) {
      case 'fontFamily':
      case 'fontSize':
      case 'fontWeight':
        return val1 === val2;

      case 'lineHeight':
      case 'letterSpacing':
        if (!val1 || !val2) return false;
        return val1.unit === val2.unit && val1.value === val2.value;

      case 'fills':
        if (!Array.isArray(val1) || !Array.isArray(val2)) return false;
        if (val1.length !== val2.length) return false;
        if (val1.length === 0 && val2.length === 0) return true;
        const f1 = val1[0];
        const f2 = val2[0];
        return f1.r === f2.r && f1.g === f2.g && f1.b === f2.b && f1.a === f2.a;

      default:
        return val1 === val2;
    }
  };

  // Compare each property
  const properties = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fills'];

  for (const prop of properties) {
    const layerValue = layer[prop];
    const styleValue = style[prop];

    if (layerValue !== undefined && styleValue !== undefined && !valuesEqual(prop, layerValue, styleValue)) {
      overrides.push({
        property: prop,
        styleValue,
        overrideValue: layerValue,
        displayStyleValue: formatValue(prop, styleValue),
        displayOverrideValue: formatValue(prop, layerValue),
      });
    }
  }

  return overrides;
}

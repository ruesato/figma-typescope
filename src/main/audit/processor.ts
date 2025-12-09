import type {
  TextLayer,
  TextStyle,
  DesignToken,
  LibrarySource,
  StyleHierarchyNode,
  AuditMetrics,
  StyleGovernanceAuditResult,
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

    // Step 6: Integrate token usage (85-88%)
    if (options.includeTokens && output.tokens.length > 0) {
      if (onProgress) onProgress(85, 'Integrating token usage...');
      await integrateTokenUsageIntoLayers(output.layers, output.tokens);
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
 * @param _allStyles - All available styles in document (reserved for future use)
 * @returns Processed TextLayer with full metadata
 */
async function processTextLayer(rawLayer: any, _allStyles: TextStyle[]): Promise<TextLayer> {
  // Get the actual Figma node for detailed analysis
  const textNode = await figma.getNodeByIdAsync(rawLayer.id);
  if (!textNode) {
    throw new Error(`Text node not found: ${rawLayer.id}`);
  }

  // Detect style assignment
  const styleAssignment = await detectStyleAssignment(textNode);

  // Extract font properties from text node
  let letterSpacing = undefined;
  if (textNode.type === 'TEXT' && textNode.characters.length > 0) {
    try {
      const rawLetterSpacing = textNode.getRangeLetterSpacing(0, 1);

      // Convert to our LetterSpacing type
      if (typeof rawLetterSpacing === 'object' && 'unit' in rawLetterSpacing && 'value' in rawLetterSpacing) {
        letterSpacing = {
          unit: rawLetterSpacing.unit,
          value: rawLetterSpacing.value,
        };

        // DEBUG: Log letterSpacing for verification
        console.log(`[DEBUG] Layer "${textNode.name}": letterSpacing =`, letterSpacing);
      }
    } catch (error) {
      console.warn(`Failed to extract letterSpacing for layer ${textNode.name}:`, error);
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
    overriddenProperties: [], // TODO: Implement override detection

    // Font Properties (Phase 2 enhancement)
    letterSpacing,
  };

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

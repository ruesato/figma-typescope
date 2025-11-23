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
import { getAllDocumentTokens } from '@/main/utils/tokenDetection';

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
 * @returns Complete processed data for audit result
 */
export async function processAuditData(
  input: ProcessorInput,
  isCancelled?: () => boolean
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

    // Step 1: Get all available styles
    const styleSummaries = await getAvailableStyles();
    const styles = convertSummariesToStyles(styleSummaries);
    output.styles = styles;

    // Step 2: Create local library source
    const localLibrary: LibrarySource = {
      id: 'local',
      name: 'Local',
      type: 'local',
      isEnabled: true,
      isAvailable: true,
      styleCount: styles.filter((s) => s.sourceType === 'local').length,
      styleIds: styles.filter((s) => s.sourceType === 'local').map((s) => s.id),
      totalUsageCount: 0, // Will be calculated
      usagePercentage: 0, // Will be calculated
    };
    output.libraries = [localLibrary];

    // Step 3: Get all available tokens (if enabled)
    if (options.includeTokens) {
      console.log('Detecting design tokens...');
      try {
        const allTokens = await getAllDocumentTokens();
        output.tokens = allTokens;
        console.log(`Found ${allTokens.length} design tokens`);
      } catch (error) {
        console.warn('Error detecting tokens:', error);
        output.tokens = [];
      }
    }

    // Step 4: Process each text layer in batches to avoid blocking main thread
    const BATCH_SIZE = 100; // Process 100 layers at a time
    for (let i = 0; i < textLayers.length; i += BATCH_SIZE) {
      // Check for cancellation
      if (isCancelled && isCancelled()) {
        throw new Error('Processing cancelled by user');
      }

      const batch = textLayers.slice(i, Math.min(i + BATCH_SIZE, textLayers.length));

      // Process batch in parallel
      const batchResults = await Promise.all(batch.map((layer) => processTextLayer(layer, styles)));

      output.layers.push(...batchResults);

      // Yield to the event loop to prevent blocking
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Step 5: Integrate token usage into layers
    if (options.includeTokens && output.tokens.length > 0) {
      await integrateTokenUsageIntoLayers(output.layers, output.tokens);
    }

    // Step 6: Categorize layers
    const { styled, unstyled } = categorizeLayers(output.layers);
    output.styledLayers = styled;
    output.unstyledLayers = unstyled;

    // Step 7: Build simple hierarchy
    output.styleHierarchy = buildSimpleHierarchy(output.styles);

    // Step 8: Calculate metrics
    output.metrics = calculateAuditMetrics(output.layers, output.styles, output.tokens);

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
 * Integrate token usage information into processed layers
 *
 * @param layers - Text layers to augment with token data
 * @param tokens - All detected tokens in the document
 */
async function integrateTokenUsageIntoLayers(
  layers: TextLayer[],
  tokens: DesignToken[]
): Promise<void> {
  // Create a map of token IDs to tokens for quick lookup
  const tokenMap = new Map(tokens.map((t) => [t.id, t]));

  // For each layer, detect which tokens it uses
  // TODO: Implement token detection from boundVariables
  // This requires enumerating boundVariables structure and matching to tokens
  // Placeholder for Phase 3 token integration
  for (const layer of layers) {
    try {
      // Get the Figma node for detailed analysis
      const node = await figma.getNodeByIdAsync(layer.id);
      if (node && 'boundVariables' in node) {
        // Note: boundVariables detection requires analyzing the boundVariables property
        // on TextNode to extract token bindings. This is deferred to Phase 3 enhancement.
        // For now, layer.tokens remains empty array
        layer.tokens = [];
      }
    } catch (error) {
      // Skip this layer if we can't fetch node data
      console.warn(`Error integrating token usage for layer ${layer.id}:`, error);
    }
  }
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

  // Token metrics
  const layersUsingTokens = layers.filter((l) => l.tokens && l.tokens.length > 0).length;
  const layersWithBothStylesAndTokens = layers.filter(
    (l) => l.assignmentStatus !== 'unstyled' && l.tokens && l.tokens.length > 0
  ).length;
  const totalTokenUsages = layers.reduce((sum, l) => sum + (l.tokens?.length || 0), 0);
  const tokenCoverageRate =
    layers.length > 0 ? Math.round((layersUsingTokens / layers.length) * 100) : 0;

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
    tokenCoverageRate,
    tokenUsageCount: totalTokenUsages,
    mixedUsageCount: layersWithBothStylesAndTokens,
    topStyles,
    deprecatedStyleCount: 0,
  };
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

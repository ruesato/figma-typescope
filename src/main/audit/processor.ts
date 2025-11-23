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
import { getStyleLibrarySource, getAvailableStyles } from '@/main/utils/styleLibrary';

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
  const { textLayers, totalPages, options } = input;

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

    // Step 3: Process each text layer in batches to avoid blocking main thread
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

    // Step 4: Categorize layers
    const { styled, unstyled } = categorizeLayers(output.layers);
    output.styledLayers = styled;
    output.unstyledLayers = unstyled;

    // Step 5: Build simple hierarchy
    output.styleHierarchy = buildSimpleHierarchy(output.styles);

    // Step 6: Calculate metrics
    output.metrics = calculateAuditMetrics(output.layers, output.styles);

    console.log(
      `Processing complete: ${output.layers.length} layers, ${output.styles.length} styles`
    );

    return output;
  } catch (error) {
    throw error;
  }
}

/**
 * Process a single text layer and extract complete metadata
 *
 * @param rawLayer - Raw text layer data from scanner
 * @param allStyles - All available styles in document
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
  for (const [name, node] of hierarchyMap) {
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
 * @returns Basic audit metrics
 */
function calculateAuditMetrics(layers: TextLayer[], styles: TextStyle[]): AuditMetrics {
  const styledCount = layers.filter((l) => l.assignmentStatus !== 'unstyled').length;
  const unstyledCount = layers.filter((l) => l.assignmentStatus === 'unstyled').length;
  const partiallyStyledCount = layers.filter(
    (l) => l.assignmentStatus === 'partially-styled'
  ).length;
  const fullyStyledCount = styledCount - partiallyStyledCount;
  const styleAdoptionRate = layers.length > 0 ? Math.round((styledCount / layers.length) * 100) : 0;

  return {
    styleAdoptionRate,
    fullyStyledCount,
    partiallyStyledCount,
    unstyledCount,
    libraryDistribution: { Local: styledCount }, // Simplified
    tokenCoverageRate: 0, // TODO: Calculate when tokens implemented
    tokenUsageCount: 0,
    mixedUsageCount: 0,
    topStyles: [], // TODO: Calculate top styles
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

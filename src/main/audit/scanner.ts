import { traverseTextNodes } from '@/main/utils/traversal';

// Figma Plugin API types
declare global {
  type BaseNode = any;
  type PageNode = any;
}

/**
 * Page Scanner for Style Governance Audit
 *
 * Traverses all pages in document and discovers text nodes.
 * Emits progress updates based on pages scanned.
 * Uses existing traversal.ts utilities for consistency.
 */

export interface ScanResult {
  textLayers: RawTextLayer[];
  totalPages: number;
  totalTextLayers: number;
  pagesScanned: number;
}

export interface RawTextLayer {
  // Basic identity
  id: string;
  name: string;

  // Content
  characters: number;
  textContent: string; // First 50 chars for preview

  // Location
  pageId: string;
  pageName: string;
  parentType: 'MAIN_COMPONENT' | 'INSTANCE' | 'FRAME' | 'GROUP';
  componentPath?: string;

  // Basic properties
  visible: boolean;
  opacity: number;

  // Style information (raw)
  textStyleId?: string;

  // Hierarchy context
  parentId?: string;
  parentName?: string;
  depth: number;

  // PERFORMANCE: Cache node reference to avoid re-fetching with getNodeByIdAsync
  // This eliminates thousands of async API calls during processing
  _nodeRef?: TextNode;
}

export interface ScanOptions {
  includeHiddenLayers?: boolean;
  progressCallback?: (progress: ScanProgress) => void;
}

export interface ScanProgress {
  pagesScanned: number;
  totalPages: number;
  textLayersFound: number;
  currentPage: string;
  progressPercent: number;
}

/**
 * Scan all pages in document and collect text layer data
 *
 * @param options - Scan configuration options
 * @param signal - AbortSignal for cancellation
 * @returns Complete scan result with all text layers
 */
export async function scanDocument(
  options: ScanOptions = {},
  signal?: AbortSignal
): Promise<ScanResult> {
  const result: ScanResult = {
    textLayers: [],
    totalPages: 0,
    totalTextLayers: 0,
    pagesScanned: 0,
  };

  try {
    // Get all pages in document
    const pages = figma.root.children as PageNode[];
    result.totalPages = pages.length;

    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Scan cancelled before starting');
    }

    // Scan each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      // Check for cancellation
      if (signal?.aborted) {
        throw new Error('Scan cancelled during page processing');
      }

      // Load page content to ensure accurate traversal
      await figma.loadPageAsync(page);

      // Traverse page and collect text nodes
      const textNodes = await traverseTextNodes(page, () => signal?.aborted || false);

      // Process each text node
      for (const textNode of textNodes) {
        // Skip hidden layers if option is false
        if (!options.includeHiddenLayers && !textNode.visible) {
          continue;
        }

        // Extract text layer data
        const textLayer = extractTextLayerData(textNode, page);

        // PERFORMANCE: Cache node reference to avoid re-fetching later
        // This eliminates async getNodeByIdAsync calls in processor
        textLayer._nodeRef = textNode;

        result.textLayers.push(textLayer);
      }

      result.pagesScanned = i + 1;
      result.totalTextLayers = result.textLayers.length;

      // Emit progress callback
      if (options.progressCallback) {
        const progress: ScanProgress = {
          pagesScanned: result.pagesScanned,
          totalPages: result.totalPages,
          textLayersFound: result.totalTextLayers,
          currentPage: page.name,
          progressPercent: Math.round((result.pagesScanned / result.totalPages) * 100),
        };

        options.progressCallback(progress);
      }
    }

    console.log(
      `Document scan complete: ${result.totalTextLayers} text layers found across ${result.totalPages} pages`
    );

    return result;
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Scan cancelled by user');
    }

    throw error;
  }
}

/**
 * Extract basic text layer data from a Figma text node
 *
 * @param textNode - The text node to extract data from
 * @param page - The page containing the text node
 * @returns RawTextLayer with basic information
 */
function extractTextLayerData(textNode: TextNode, page: PageNode): RawTextLayer {
  // Determine parent type and component context
  const parentContext = getParentContext(textNode);

  return {
    // Identity
    id: textNode.id,
    name: textNode.name,

    // Content
    characters: textNode.characters.length,
    textContent: textNode.characters.substring(0, 50), // First 50 chars

    // Location
    pageId: page.id,
    pageName: page.name,
    parentType: parentContext.type,
    componentPath: parentContext.componentPath,

    // Basic properties
    visible: textNode.visible,
    opacity: textNode.opacity,

    // Style information (raw)
    textStyleId: textNode.textStyleId,

    // Hierarchy context
    parentId: textNode.parent?.id,
    parentName: textNode.parent?.name,
    depth: parentContext.depth,
  };
}

/**
 * Get parent context information for a text node
 *
 * @param node - The text node to analyze
 * @returns Parent context with type and component path
 */
function getParentContext(node: TextNode): {
  type: 'MAIN_COMPONENT' | 'INSTANCE' | 'FRAME' | 'GROUP';
  componentPath?: string;
  depth: number;
} {
  let current: BaseNode | null = node;
  let depth = 0;
  const componentPath: string[] = [];

  // Walk up the parent hierarchy
  while (current && current.parent) {
    current = current.parent;
    depth++;

    if (current) {
      // Check if this is a component-related node
      if (current.type === 'COMPONENT' || current.type === 'COMPONENT_SET') {
        componentPath.unshift(current.name);
      }

      // Stop at page level
      if (current.type === 'PAGE') {
        break;
      }
    }
  }

  // Determine parent type based on immediate parent
  const immediateParent = node.parent;
  let parentType: 'MAIN_COMPONENT' | 'INSTANCE' | 'FRAME' | 'GROUP';

  if (!immediateParent) {
    parentType = 'FRAME'; // Top-level frame
  } else if (immediateParent.type === 'COMPONENT') {
    parentType = 'MAIN_COMPONENT';
  } else if (immediateParent.type === 'INSTANCE') {
    parentType = 'INSTANCE';
  } else if (immediateParent.type === 'FRAME') {
    parentType = 'FRAME';
  } else {
    parentType = 'GROUP';
  }

  return {
    type: parentType,
    componentPath: componentPath.length > 0 ? componentPath.join(' / ') : undefined,
    depth,
  };
}

/**
 * Scan a single page (for partial scans or testing)
 *
 * @param page - The page to scan
 * @param options - Scan configuration options
 * @param signal - AbortSignal for cancellation
 * @returns Scan result for single page
 */
export async function scanSinglePage(
  page: PageNode,
  options: ScanOptions = {},
  signal?: AbortSignal
): Promise<ScanResult> {
  const result: ScanResult = {
    textLayers: [],
    totalPages: 1,
    totalTextLayers: 0,
    pagesScanned: 0,
  };

  try {
    // Load page content
    await figma.loadPageAsync(page);

    // Traverse page and collect text nodes
    const textNodes = await traverseTextNodes(page, () => signal?.aborted || false);

    // Process each text node
    for (const textNode of textNodes) {
      // Skip hidden layers if option is false
      if (!options.includeHiddenLayers && !textNode.visible) {
        continue;
      }

      // Extract text layer data
      const textLayer = extractTextLayerData(textNode, page);
      result.textLayers.push(textLayer);
    }

    result.pagesScanned = 1;
    result.totalTextLayers = result.textLayers.length;

    console.log(
      `Single page scan complete: ${result.totalTextLayers} text layers found in "${page.name}"`
    );

    return result;
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Page scan cancelled by user');
    }

    throw error;
  }
}

/**
 * Get quick scan statistics without full traversal
 *
 * @param signal - AbortSignal for cancellation
 * @returns Basic statistics about document
 */
export async function getQuickScanStats(signal?: AbortSignal): Promise<{
  totalPages: number;
  estimatedTextLayers: number;
  hasComponents: boolean;
  hasLibraries: boolean;
}> {
  const pages = figma.root.children as PageNode[];

  let estimatedTextLayers = 0;
  let hasComponents = false;
  let hasLibraries = false;

  try {
    // Check for team libraries
    try {
      const libraries = await figma.teamLibrary.getAvailableLibrariesAsync();
      hasLibraries = libraries.length > 0;
    } catch {
      hasLibraries = false;
    }

    // Quick count using findAllWithCriteria (faster than full traversal)
    for (const page of pages) {
      if (signal?.aborted) {
        throw new Error('Quick scan cancelled');
      }

      await figma.loadPageAsync(page);

      const textNodes = page.findAllWithCriteria({ types: ['TEXT'] });
      estimatedTextLayers += textNodes.length;

      // Check for components
      const components = page.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
      if (components.length > 0) {
        hasComponents = true;
      }
    }

    return {
      totalPages: pages.length,
      estimatedTextLayers,
      hasComponents,
      hasLibraries,
    };
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Quick scan cancelled by user');
    }

    throw error;
  }
}

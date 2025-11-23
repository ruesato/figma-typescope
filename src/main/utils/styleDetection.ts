import type { StyleAssignment, PropertyMatchMap } from '@/shared/types';

/**
 * Text style detection and comparison utilities
 *
 * Detects if text nodes have styles assigned and compares
 * their properties to determine match status.
 */

/**
 * Detect style assignment status for a text node
 *
 * Checks if a node has a text style applied and which properties match.
 * Returns 'fully-styled' if all properties match, 'partially-styled' if some
 * match, or 'unstyled' if no style is applied.
 *
 * @param node - The text node to check
 * @returns StyleAssignment object with status and property matches
 *
 * @example
 * ```ts
 * const assignment = await detectStyleAssignment(textNode);
 * if (assignment.assignmentStatus === 'partially-styled') {
 *   console.log('Some properties overridden:', assignment.propertyMatches);
 * }
 * ```
 */
export async function detectStyleAssignment(node: TextNode): Promise<StyleAssignment> {
  // Check if node has a text style applied
  const textStyleId = node.textStyleId;

  if (!textStyleId || typeof textStyleId === 'symbol') {
    // No style applied (or mixed styles)
    return {
      assignmentStatus: 'unstyled',
    };
  }

  // Get the text style
  const textStyle = await figma.getStyleByIdAsync(textStyleId);

  if (!textStyle || textStyle.type !== 'TEXT') {
    return {
      assignmentStatus: 'unstyled',
    };
  }

  // Get library source if it's from a library
  let libraryName: string | undefined;
  if (textStyle.remote) {
    // Resolve library name from key
    // The processor.ts now handles full library resolution,
    // but we provide basic resolution here for consistency
    try {
      if (figma.teamLibrary && typeof figma.teamLibrary.getAvailableLibrariesAsync === 'function') {
        const libraries = await figma.teamLibrary.getAvailableLibrariesAsync();
        const keyParts = textStyle.key.split('/');
        if (keyParts.length >= 2) {
          const libraryKey = keyParts[0];
          const library = libraries.find((lib: any) => lib.key === libraryKey);
          libraryName = library?.name || `Library (${libraryKey.substring(0, 8)}...)`;
        } else {
          libraryName = 'External Library';
        }
      } else {
        libraryName = 'External Library';
      }
    } catch (error) {
      libraryName = 'External Library';
    }
  }

  // Compare properties to see which ones match
  const propertyMatches = compareStyleProperties(node, textStyle);

  // Determine assignment status based on matches
  const matchedCount = Object.values(propertyMatches).filter(Boolean).length;
  const totalCount = Object.keys(propertyMatches).length;

  let assignmentStatus: StyleAssignment['assignmentStatus'];
  if (matchedCount === totalCount) {
    assignmentStatus = 'fully-styled';
  } else if (matchedCount > 0) {
    assignmentStatus = 'partially-styled';
  } else {
    assignmentStatus = 'unstyled';
  }

  return {
    assignmentStatus,
    styleId: textStyleId,
    styleName: textStyle.name,
    libraryName,
    propertyMatches,
  };
}

/**
 * Compare text node properties with a text style
 *
 * Checks which properties of a text node match the applied text style.
 * Properties checked: font family, size, weight, line height, color.
 *
 * @param node - The text node
 * @param style - The text style to compare against
 * @returns PropertyMatchMap indicating which properties match
 *
 * @example
 * ```ts
 * const matches = compareStyleProperties(textNode, textStyle);
 * if (!matches.fontSize) {
 *   console.log('Font size has been overridden');
 * }
 * ```
 */
export function compareStyleProperties(node: TextNode, style: TextStyle): PropertyMatchMap {
  const matches: PropertyMatchMap = {
    fontFamily: false,
    fontSize: false,
    fontWeight: false,
    lineHeight: false,
    color: false,
  };

  try {
    // Check if node has any characters
    if (node.characters.length === 0) {
      return matches; // Return all false for empty nodes
    }

    // Get node properties (using character 0 for mixed styles)
    const nodeFontName = node.getRangeFontName(0, 1) as FontName;
    const nodeFontSize = node.getRangeFontSize(0, 1) as number;
    const nodeFontWeight = node.getRangeFontWeight(0, 1) as number;
    const nodeLineHeight = node.getRangeLineHeight(0, 1);
    const nodeFills = node.getRangeFills(0, 1) as readonly Paint[];

    // Get style properties
    const styleFontName = style.fontName;
    const styleFontSize = style.fontSize;
    const styleFontWeight = style.fontWeight;
    const styleLineHeight = style.lineHeight;
    const styleFills = style.fills as readonly Paint[] | undefined;

    // Compare font family
    if (
      nodeFontName.family === styleFontName.family &&
      nodeFontName.style === styleFontName.style
    ) {
      matches.fontFamily = true;
    }

    // Compare font size
    if (nodeFontSize === styleFontSize) {
      matches.fontSize = true;
    }

    // Compare font weight (with tolerance for slight differences)
    if (Math.abs(nodeFontWeight - styleFontWeight) < 10) {
      matches.fontWeight = true;
    }

    // Compare line height
    if (compareLineHeight(nodeLineHeight, styleLineHeight)) {
      matches.lineHeight = true;
    }

    // Compare color (first solid fill)
    if (styleFills && compareFills(nodeFills, styleFills)) {
      matches.color = true;
    }
  } catch (error) {
    // If we can't compare properties, mark all as false
    console.warn('Error comparing style properties:', error);
  }

  return matches;
}

/**
 * Compare two line height values for equality
 *
 * @param a - First line height
 * @param b - Second line height
 * @returns True if line heights are equal
 */
function compareLineHeight(a: LineHeight, b: LineHeight): boolean {
  if (typeof a === 'symbol' && typeof b === 'symbol') {
    return true; // Both AUTO
  }

  if (typeof a === 'symbol' || typeof b === 'symbol') {
    return false; // One is AUTO, other is not
  }

  if ('unit' in a && 'unit' in b) {
    return a.unit === b.unit && Math.abs(a.value - b.value) < 0.01;
  }

  return false;
}

/**
 * Compare two fill arrays for equality
 *
 * Only compares the first solid fill color.
 *
 * @param a - First fills array
 * @param b - Second fills array
 * @returns True if fills are equal
 */
function compareFills(a: readonly Paint[], b: readonly Paint[]): boolean {
  // Ensure both arrays exist and are valid
  if (!a || !Array.isArray(a) || !b || !Array.isArray(b)) {
    return false;
  }

  const solidA = a.find((fill) => fill.type === 'SOLID') as SolidPaint | undefined;
  const solidB = b.find((fill) => fill.type === 'SOLID') as SolidPaint | undefined;

  if (!solidA || !solidB) {
    return false; // Can't compare non-solid fills
  }

  const colorMatch =
    Math.abs(solidA.color.r - solidB.color.r) < 0.01 &&
    Math.abs(solidA.color.g - solidB.color.g) < 0.01 &&
    Math.abs(solidA.color.b - solidB.color.b) < 0.01;

  const opacityA = solidA.opacity ?? 1;
  const opacityB = solidB.opacity ?? 1;
  const opacityMatch = Math.abs(opacityA - opacityB) < 0.01;

  return colorMatch && opacityMatch;
}

/**
 * Calculate style coverage percentage
 *
 * @param propertyMatches - Map of property matches
 * @returns Percentage of properties that match (0-100)
 */
export function calculateStyleCoverage(propertyMatches: PropertyMatchMap): number {
  const matched = Object.values(propertyMatches).filter(Boolean).length;
  const total = Object.keys(propertyMatches).length;
  return Math.round((matched / total) * 100);
}

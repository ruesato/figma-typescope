import type { TextLayerData, RGBA, LineHeight } from '@/shared/types';
import { buildComponentHierarchy } from './hierarchy';

/**
 * Font metadata extraction utilities
 *
 * Extracts font and text properties from Figma TextNode objects
 * and converts them into the plugin's data format.
 */

/**
 * Extract complete font metadata from a text node
 *
 * Extracts all font properties, text content, visibility, and component context.
 * Handles mixed text styles by using the style at character 0.
 *
 * @param node - The text node to extract metadata from
 * @returns TextLayerData object with all extracted properties
 *
 * @example
 * ```ts
 * const textNode = await figma.getNodeByIdAsync(id) as TextNode;
 * const metadata = await extractFontMetadata(textNode);
 * console.log(`Font: ${metadata.fontFamily} ${metadata.fontSize}px`);
 * ```
 */
export async function extractFontMetadata(
  node: TextNode
): Promise<Omit<TextLayerData, 'styleAssignment' | 'matchSuggestions'>> {
  // Get font properties (using character 0 for mixed styles)
  const fontName = node.getRangeFontName(0, 1) as FontName;
  const fontSize = node.getRangeFontSize(0, 1) as number;
  const fontWeight = node.getRangeFontWeight(0, 1) as number;
  const lineHeight = node.getRangeLineHeight(0, 1);

  // Get fill color (use first fill, default to black if none)
  const fills = node.getRangeFills(0, 1) as readonly Paint[];
  const solidFill = fills.find((fill) => fill.type === 'SOLID') as
    | SolidPaint
    | undefined;
  const color: RGBA = solidFill
    ? {
        r: solidFill.color.r,
        g: solidFill.color.g,
        b: solidFill.color.b,
        a: solidFill.opacity ?? 1,
      }
    : { r: 0, g: 0, b: 0, a: 1 };

  // Extract line height with proper type handling
  const extractedLineHeight: LineHeight = extractLineHeight(lineHeight);

  // Build component hierarchy path
  const componentContext = buildComponentHierarchy(node);

  return {
    id: node.id,
    content: node.characters,
    fontFamily: fontName.family,
    fontSize,
    fontWeight,
    lineHeight: extractedLineHeight,
    color,
    opacity: node.opacity,
    visible: node.visible,
    componentContext,
  };
}

/**
 * Extract line height value with proper type handling
 *
 * Figma's LineHeight can be "AUTO", a pixel value, or a percentage.
 * This function normalizes it to our LineHeight type.
 *
 * @param lineHeight - The Figma LineHeight object
 * @returns Normalized LineHeight object
 */
function extractLineHeight(lineHeight: LineHeight): LineHeight {
  if (typeof lineHeight === 'symbol') {
    // LineHeight is "AUTO"
    return {
      unit: 'AUTO',
    };
  }

  if ('unit' in lineHeight) {
    if (lineHeight.unit === 'AUTO') {
      return {
        unit: 'AUTO',
      };
    }
    if ('value' in lineHeight) {
      return {
        unit: lineHeight.unit,
        value: lineHeight.value,
      };
    }
  }

  // Fallback to AUTO if we can't determine the type
  return {
    unit: 'AUTO',
  };
}

/**
 * Check if a text node has mixed styles
 *
 * A text node has mixed styles if different characters have different
 * font properties (family, size, weight, etc.).
 *
 * @param node - The text node to check
 * @returns True if the node has mixed styles
 *
 * @example
 * ```ts
 * if (hasMixedStyles(textNode)) {
 *   console.warn('This text has mixed styles - using first character style');
 * }
 * ```
 */
export function hasMixedStyles(node: TextNode): boolean {
  const length = node.characters.length;
  if (length <= 1) return false;

  try {
    // Check if any style properties return figma.mixed
    const fontName = node.getRangeFontName(0, length);
    const fontSize = node.getRangeFontSize(0, length);
    const fontWeight = node.getRangeFontWeight(0, length);

    return (
      fontName === figma.mixed ||
      fontSize === figma.mixed ||
      fontWeight === figma.mixed
    );
  } catch {
    // If we get an error, assume mixed styles
    return true;
  }
}

/**
 * Get text content preview (truncated for display)
 *
 * @param text - The full text content
 * @param maxLength - Maximum length before truncation (default: 50)
 * @returns Truncated text with ellipsis if needed
 *
 * @example
 * ```ts
 * const preview = getTextPreview('This is a very long text...', 20);
 * // Returns: "This is a very lo..."
 * ```
 */
export function getTextPreview(text: string, maxLength = 50): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format font name for display
 *
 * @param fontFamily - The font family name
 * @param fontWeight - The font weight value
 * @returns Formatted string like "Inter Regular" or "Roboto Bold"
 */
export function formatFontName(fontFamily: string, fontWeight: number): string {
  const weightName = getFontWeightName(fontWeight);
  return `${fontFamily} ${weightName}`;
}

/**
 * Convert numeric font weight to name
 *
 * @param weight - Numeric weight (100-900)
 * @returns Weight name (e.g., "Regular", "Bold", "Light")
 */
function getFontWeightName(weight: number): string {
  const weightMap: Record<number, string> = {
    100: 'Thin',
    200: 'Extra Light',
    300: 'Light',
    400: 'Regular',
    500: 'Medium',
    600: 'Semi Bold',
    700: 'Bold',
    800: 'Extra Bold',
    900: 'Black',
  };

  return weightMap[weight] || String(weight);
}

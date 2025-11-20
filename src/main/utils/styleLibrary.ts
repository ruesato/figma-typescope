import type { TextStyleSummary } from '@/shared/types';

/**
 * Text style and library utilities
 *
 * Functions for retrieving available text styles and their library sources.
 */

/**
 * Get library source information for a text style
 *
 * Determines if a style is from the current file, a library, or the Figma defaults.
 *
 * @param style - The text style to check
 * @returns Object with library name and whether it's remote
 *
 * @example
 * ```ts
 * const source = getStyleLibrarySource(textStyle);
 * console.log(`Style from: ${source.libraryName}`);
 * ```
 */
export function getStyleLibrarySource(style: TextStyle): {
  libraryName: string;
  isRemote: boolean;
} {
  if (style.remote) {
    // Style is from a library
    // Try to get the library name from the key
    // Note: Figma doesn't provide direct library name access in plugins
    // We use the key as an identifier
    return {
      libraryName: `Library (${style.key.substring(0, 8)}...)`,
      isRemote: true,
    };
  } else {
    // Style is local to this file
    return {
      libraryName: 'Current File',
      isRemote: false,
    };
  }
}

/**
 * Get all available text styles in the current file
 *
 * Retrieves all local text styles, excluding remote library styles.
 *
 * @returns Array of TextStyleSummary objects
 *
 * @example
 * ```ts
 * const styles = await getAvailableStyles();
 * console.log(`Found ${styles.length} text styles`);
 * ```
 */
export async function getAvailableStyles(): Promise<TextStyleSummary[]> {
  const localStyles = await figma.getLocalTextStylesAsync();

  return localStyles.map((style) => {
    const source = getStyleLibrarySource(style);

    return {
      id: style.id,
      name: style.name,
      libraryName: source.libraryName,
      isRemote: source.isRemote,
      fontFamily: style.fontName.family,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    };
  });
}

/**
 * Group text styles by library
 *
 * @param styles - Array of text style summaries
 * @returns Map of library name to styles
 *
 * @example
 * ```ts
 * const styles = await getAvailableStyles();
 * const grouped = groupStylesByLibrary(styles);
 * for (const [library, styles] of grouped) {
 *   console.log(`${library}: ${styles.length} styles`);
 * }
 * ```
 */
export function groupStylesByLibrary(
  styles: TextStyleSummary[]
): Map<string, TextStyleSummary[]> {
  const grouped = new Map<string, TextStyleSummary[]>();

  for (const style of styles) {
    const library = style.libraryName;
    if (!grouped.has(library)) {
      grouped.set(library, []);
    }
    grouped.get(library)!.push(style);
  }

  return grouped;
}

/**
 * Find text style by ID
 *
 * @param styleId - The style ID to find
 * @returns The text style or null if not found
 */
export async function findTextStyleById(
  styleId: string
): Promise<TextStyle | null> {
  try {
    const style = await figma.getStyleByIdAsync(styleId);
    if (style && style.type === 'TEXT') {
      return style as TextStyle;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get unique font families from text styles
 *
 * @param styles - Array of text style summaries
 * @returns Sorted array of unique font family names
 */
export function getUniqueFontFamilies(styles: TextStyleSummary[]): string[] {
  const families = new Set(styles.map((s) => s.fontFamily));
  return Array.from(families).sort();
}

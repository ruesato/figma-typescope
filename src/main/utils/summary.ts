import type { TextLayerData, AuditSummary } from '@/shared/types';

/**
 * Audit summary calculation utilities
 *
 * Calculates aggregate statistics and insights from collected text layer data.
 */

/**
 * Calculate audit summary from text layer data
 *
 * Computes total counts, unique values, coverage percentages, and other metrics.
 *
 * @param textLayers - Array of collected text layer data
 * @returns AuditSummary object with calculated statistics
 *
 * @example
 * ```ts
 * const summary = calculateSummary(textLayers);
 * console.log(`Style coverage: ${summary.styleCoveragePercent}%`);
 * ```
 */
export function calculateSummary(textLayers: TextLayerData[]): AuditSummary {
  const totalTextLayers = textLayers.length;

  // Calculate unique font families
  const fontFamilies = new Set(textLayers.map((layer) => layer.fontFamily));
  const uniqueFontFamilies = fontFamilies.size;

  // Calculate style coverage
  const fullyStyled = textLayers.filter(
    (layer) => layer.styleAssignment.assignmentStatus === 'fully-styled'
  ).length;
  const styleCoveragePercent =
    totalTextLayers > 0 ? Math.round((fullyStyled / totalTextLayers) * 100) : 0;

  // Get libraries in use
  const libraries = new Set<string>();
  for (const layer of textLayers) {
    if (layer.styleAssignment.libraryName) {
      libraries.add(layer.styleAssignment.libraryName);
    }
  }
  const librariesInUse = Array.from(libraries).sort();

  // Count potential matches (layers with match suggestions)
  const potentialMatchesCount = textLayers.filter(
    (layer) => layer.matchSuggestions && layer.matchSuggestions.length > 0
  ).length;

  // Count hidden layers
  const hiddenLayersCount = textLayers.filter((layer) => !layer.visible).length;

  return {
    totalTextLayers,
    uniqueFontFamilies,
    styleCoveragePercent,
    librariesInUse,
    potentialMatchesCount,
    hiddenLayersCount,
  };
}

/**
 * Get breakdown by assignment status
 *
 * @param textLayers - Array of text layer data
 * @returns Count of each assignment status
 */
export function getAssignmentStatusBreakdown(textLayers: TextLayerData[]): {
  fullyStyled: number;
  partiallyStyled: number;
  unstyled: number;
} {
  return {
    fullyStyled: textLayers.filter(
      (l) => l.styleAssignment.assignmentStatus === 'fully-styled'
    ).length,
    partiallyStyled: textLayers.filter(
      (l) => l.styleAssignment.assignmentStatus === 'partially-styled'
    ).length,
    unstyled: textLayers.filter(
      (l) => l.styleAssignment.assignmentStatus === 'unstyled'
    ).length,
  };
}

/**
 * Get breakdown by component type
 *
 * @param textLayers - Array of text layer data
 * @returns Count of each component type
 */
export function getComponentTypeBreakdown(textLayers: TextLayerData[]): {
  mainComponent: number;
  instance: number;
  plain: number;
} {
  return {
    mainComponent: textLayers.filter(
      (l) => l.componentContext.componentType === 'main-component'
    ).length,
    instance: textLayers.filter(
      (l) => l.componentContext.componentType === 'instance'
    ).length,
    plain: textLayers.filter(
      (l) => l.componentContext.componentType === 'plain'
    ).length,
  };
}

/**
 * Get font usage statistics
 *
 * @param textLayers - Array of text layer data
 * @returns Map of font family to usage count
 */
export function getFontUsageStats(
  textLayers: TextLayerData[]
): Map<string, number> {
  const usage = new Map<string, number>();

  for (const layer of textLayers) {
    const family = layer.fontFamily;
    usage.set(family, (usage.get(family) || 0) + 1);
  }

  return usage;
}

/**
 * Get top fonts by usage
 *
 * @param textLayers - Array of text layer data
 * @param limit - Maximum number of fonts to return (default: 10)
 * @returns Array of [fontFamily, count] pairs sorted by usage
 */
export function getTopFonts(
  textLayers: TextLayerData[],
  limit = 10
): Array<[string, number]> {
  const usage = getFontUsageStats(textLayers);
  return Array.from(usage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

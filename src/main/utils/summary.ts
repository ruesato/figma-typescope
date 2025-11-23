import type { TextLayerData, AuditSummary, TextLayer, DesignToken } from '@/shared/types';

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
    fullyStyled: textLayers.filter((l) => l.styleAssignment.assignmentStatus === 'fully-styled')
      .length,
    partiallyStyled: textLayers.filter(
      (l) => l.styleAssignment.assignmentStatus === 'partially-styled'
    ).length,
    unstyled: textLayers.filter((l) => l.styleAssignment.assignmentStatus === 'unstyled').length,
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
    mainComponent: textLayers.filter((l) => l.componentContext.componentType === 'main-component')
      .length,
    instance: textLayers.filter((l) => l.componentContext.componentType === 'instance').length,
    plain: textLayers.filter((l) => l.componentContext.componentType === 'plain').length,
  };
}

/**
 * Get font usage statistics
 *
 * @param textLayers - Array of text layer data
 * @returns Map of font family to usage count
 */
export function getFontUsageStats(textLayers: TextLayerData[]): Map<string, number> {
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
export function getTopFonts(textLayers: TextLayerData[], limit = 10): Array<[string, number]> {
  const usage = getFontUsageStats(textLayers);
  return Array.from(usage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/**
 * Calculate token adoption rate and coverage metrics
 *
 * @param layers - Array of processed text layers
 * @param tokens - Array of detected design tokens
 * @returns Token metrics including adoption rate and coverage
 */
export function calculateTokenMetrics(
  layers: TextLayer[],
  tokens: DesignToken[]
): {
  tokenAdoptionRate: number;
  tokenUsageCount: number;
  mixedUsageCount: number;
  tokenCoverageRate: number;
  unusedTokenCount: number;
  topTokensByUsage: Array<{ name: string; usageCount: number; type: string }>;
} {
  // Count layers using tokens
  const layersWithTokens = layers.filter((l) => l.tokens && l.tokens.length > 0).length;
  const tokenAdoptionRate =
    layers.length > 0 ? Math.round((layersWithTokens / layers.length) * 100) : 0;

  // Count total token usages
  const tokenUsageCount = layers.reduce((sum, l) => sum + (l.tokens?.length || 0), 0);

  // Count layers using both styles and tokens (mixed usage)
  const mixedUsageCount = layers.filter(
    (l) => l.assignmentStatus !== 'unstyled' && l.tokens && l.tokens.length > 0
  ).length;

  // Calculate token coverage (% of tokens that are actually used)
  const usedTokenIds = new Set<string>();
  for (const layer of layers) {
    if (layer.tokens) {
      for (const binding of layer.tokens) {
        usedTokenIds.add(binding.tokenId);
      }
    }
  }
  const tokenCoverageRate =
    tokens.length > 0 ? Math.round((usedTokenIds.size / tokens.length) * 100) : 0;

  // Count unused tokens
  const unusedTokenCount = tokens.length - usedTokenIds.size;

  // Get top tokens by usage
  const tokenUsageMap = new Map<string, { count: number; type: string }>();
  for (const layer of layers) {
    if (layer.tokens) {
      for (const binding of layer.tokens) {
        const token = tokens.find((t) => t.id === binding.tokenId);
        if (token) {
          const existing = tokenUsageMap.get(binding.tokenId);
          tokenUsageMap.set(binding.tokenId, {
            count: (existing?.count || 0) + 1,
            type: token.type,
          });
        }
      }
    }
  }

  const topTokensByUsage = Array.from(tokenUsageMap.entries())
    .map(([tokenId, data]) => {
      const token = tokens.find((t) => t.id === tokenId);
      return {
        name: token?.name || 'Unknown',
        usageCount: data.count,
        type: data.type,
      };
    })
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 10);

  return {
    tokenAdoptionRate,
    tokenUsageCount,
    mixedUsageCount,
    tokenCoverageRate,
    unusedTokenCount,
    topTokensByUsage,
  };
}

/**
 * Get token usage breakdown by collection
 *
 * @param tokens - Array of design tokens
 * @returns Map of collection name to token count
 */
export function getTokensByCollection(tokens: DesignToken[]): Map<string, number> {
  const breakdown = new Map<string, number>();

  for (const token of tokens) {
    // Assume collection is extracted from token name or metadata
    const collectionName = token.name.split('/')[0] || 'Other';
    breakdown.set(collectionName, (breakdown.get(collectionName) || 0) + 1);
  }

  return breakdown;
}

/**
 * Get token usage breakdown by type
 *
 * @param tokens - Array of design tokens
 * @returns Map of token type to count
 */
export function getTokensByType(tokens: DesignToken[]): Map<string, number> {
  const breakdown = new Map<string, number>();

  for (const token of tokens) {
    const type = token.type || 'unknown';
    breakdown.set(type, (breakdown.get(type) || 0) + 1);
  }

  return breakdown;
}

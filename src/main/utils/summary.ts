import type { TextLayerData, AuditSummary, TextLayer, DesignToken } from '@/shared/types';

/**
 * Audit summary calculation utilities (T128)
 *
 * Optimized to O(n) complexity using single-pass iteration with Maps
 * instead of multiple array.filter() calls (O(n²) total).
 *
 * Calculates aggregate statistics and insights from collected text layer data.
 */

/**
 * Calculate audit summary from text layer data - Optimized O(n)
 *
 * Computes total counts, unique values, coverage percentages, and other metrics.
 * Uses single-pass iteration to minimize CPU usage for 10k-50k layer documents.
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

  // Use single pass to collect all metrics - O(n) instead of O(n²)
  const fontFamilies = new Set<string>();
  const libraries = new Set<string>();
  let fullyStyled = 0;
  let potentialMatchesCount = 0;
  let hiddenLayersCount = 0;

  for (const layer of textLayers) {
    // Track fonts
    fontFamilies.add(layer.fontFamily);

    // Count fully styled
    if (layer.styleAssignment.assignmentStatus === 'fully-styled') {
      fullyStyled++;
    }

    // Track libraries
    if (layer.styleAssignment.libraryName) {
      libraries.add(layer.styleAssignment.libraryName);
    }

    // Count layers with match suggestions
    if (layer.matchSuggestions && layer.matchSuggestions.length > 0) {
      potentialMatchesCount++;
    }

    // Count hidden layers
    if (!layer.visible) {
      hiddenLayersCount++;
    }
  }

  const styleCoveragePercent =
    totalTextLayers > 0 ? Math.round((fullyStyled / totalTextLayers) * 100) : 0;
  const librariesInUse = Array.from(libraries).sort();

  return {
    totalTextLayers,
    uniqueFontFamilies: fontFamilies.size,
    styleCoveragePercent,
    librariesInUse,
    potentialMatchesCount,
    hiddenLayersCount,
  };
}

/**
 * Get breakdown by assignment status - Optimized O(n)
 *
 * @param textLayers - Array of text layer data
 * @returns Count of each assignment status
 */
export function getAssignmentStatusBreakdown(textLayers: TextLayerData[]): {
  fullyStyled: number;
  partiallyStyled: number;
  unstyled: number;
} {
  let fullyStyled = 0;
  let partiallyStyled = 0;
  let unstyled = 0;

  for (const layer of textLayers) {
    switch (layer.styleAssignment.assignmentStatus) {
      case 'fully-styled':
        fullyStyled++;
        break;
      case 'partially-styled':
        partiallyStyled++;
        break;
      case 'unstyled':
        unstyled++;
        break;
    }
  }

  return { fullyStyled, partiallyStyled, unstyled };
}

/**
 * Get breakdown by component type - Optimized O(n)
 *
 * @param textLayers - Array of text layer data
 * @returns Count of each component type
 */
export function getComponentTypeBreakdown(textLayers: TextLayerData[]): {
  mainComponent: number;
  instance: number;
  plain: number;
} {
  let mainComponent = 0;
  let instance = 0;
  let plain = 0;

  for (const layer of textLayers) {
    switch (layer.componentContext.componentType) {
      case 'main-component':
        mainComponent++;
        break;
      case 'instance':
        instance++;
        break;
      case 'plain':
        plain++;
        break;
    }
  }

  return { mainComponent, instance, plain };
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
 * Calculate token adoption rate and coverage metrics - Optimized O(n) with Map lookup
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
  // Create token map for O(1) lookup instead of array.find() - O(n)
  const tokenMap = new Map<string, DesignToken>();
  for (const token of tokens) {
    tokenMap.set(token.id, token);
  }

  // Single pass through layers for all metrics - O(n) instead of multiple passes
  const usedTokenIds = new Set<string>();
  const tokenUsageMap = new Map<string, { count: number; type: string; name: string }>();
  let layersWithTokens = 0;
  let tokenUsageCount = 0;
  let mixedUsageCount = 0;

  for (const layer of layers) {
    if (layer.tokens && layer.tokens.length > 0) {
      layersWithTokens++;
      tokenUsageCount += layer.tokens.length;

      // Check for mixed usage
      if (layer.assignmentStatus !== 'unstyled') {
        mixedUsageCount++;
      }

      // Track used tokens and usage counts
      for (const binding of layer.tokens) {
        usedTokenIds.add(binding.tokenId);
        const token = tokenMap.get(binding.tokenId);
        if (token) {
          const existing = tokenUsageMap.get(binding.tokenId);
          tokenUsageMap.set(binding.tokenId, {
            count: (existing?.count || 0) + 1,
            type: token.type,
            name: token.name,
          });
        }
      }
    }
  }

  const tokenAdoptionRate = layers.length > 0 ? Math.round((layersWithTokens / layers.length) * 100) : 0;
  const tokenCoverageRate = tokens.length > 0 ? Math.round((usedTokenIds.size / tokens.length) * 100) : 0;
  const unusedTokenCount = tokens.length - usedTokenIds.size;

  // Get top tokens by usage
  const topTokensByUsage = Array.from(tokenUsageMap.entries())
    .map(([_, data]) => ({
      name: data.name,
      usageCount: data.count,
      type: data.type,
    }))
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

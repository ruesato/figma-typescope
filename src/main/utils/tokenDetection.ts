import type { DesignToken } from '@/shared/types';

/**
 * Token Detection Utility
 *
 * Detects design tokens in text layers using Figma Variables API.
 * Per research findings (R5), tokens are accessed via:
 * - boundVariables property on TextNode
 * - figma.variables API for metadata resolution
 * - Token modes for multi-mode variables
 *
 * Key capabilities:
 * - Detects all token bindings on a text layer
 * - Resolves token metadata (name, value, collection, mode)
 * - Handles multi-mode tokens correctly
 * - Gracefully handles missing tokens (deleted variables)
 */

/**
 * Format token value for display
 * @param value - The raw token value
 * @param _tokenType - Token type classification (reserved for future use)
 * @returns Formatted string representation
 */
function formatTokenValue(value: any, _tokenType: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Handle color objects
  if (typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    const r = Math.round(value.r * 255);
    const g = Math.round(value.g * 255);
    const b = Math.round(value.b * 255);
    const a = value.a !== undefined ? value.a : 1;
    if (a === 1) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Handle string values
  if (typeof value === 'string') {
    return value;
  }

  // Handle numeric values
  if (typeof value === 'number') {
    return String(value);
  }

  // Default: stringify
  return JSON.stringify(value);
}

/**
 * Extract token modes if variable supports multiple modes
 *
 * @param variable - Figma variable object
 * @returns Map of mode ID → value, or undefined for single-mode tokens
 */
function extractTokenModes(variable: any): Record<string, string> | undefined {
  try {
    const modes = variable.valuesByMode;
    if (!modes || Object.keys(modes).length <= 1) {
      return undefined; // Single mode or no modes
    }

    // Multi-mode token - return mode information
    const modeMap: Record<string, string> = {};
    for (const [modeId, value] of Object.entries(modes)) {
      modeMap[modeId] = formatTokenValue(value, 'custom');
    }
    return modeMap;
  } catch (error) {
    return undefined;
  }
}

/**
 * Get all design tokens from a document
 *
 * Useful for building complete token inventory during audit.
 *
 * @returns Array of all tokens in document
 */
export async function getAllDocumentTokens(): Promise<DesignToken[]> {
  try {
    const tokenMap = new Map<string, DesignToken>();

    // Get all variable collections
    const collections = await figma.variables.getLocalVariableCollectionsAsync();

    for (const collection of collections) {
      // Get all variables in this collection
      const variables = await figma.variables.getVariablesInCollectionAsync(collection.id);

      for (const variable of variables) {
        if (!tokenMap.has(variable.id)) {
          const firstModeId = Object.keys(variable.valuesByMode)[0];
          const firstValue = variable.valuesByMode[firstModeId];
          const token: DesignToken = {
            id: variable.id,
            name: variable.name,
            collection: collection.name,
            value: formatTokenValue(firstValue, 'custom'),
            type: 'custom',
            usageCount: 0,
            layerIds: [],
            modes: extractTokenModes(variable),
          };
          tokenMap.set(variable.id, token);
        }
      }
    }

    return Array.from(tokenMap.values());
  } catch (error) {
    console.warn('Error getting all document tokens:', error);
    return [];
  }
}

/**
 * Find all layers using a specific token
 *
 * Useful for replacement operations and usage tracking.
 *
 * @param tokenId - Token ID to search for
 * @returns Array of layer IDs using this token
 */
export function findLayersUsingToken(tokenId: string): string[] {
  const layerIds: string[] = [];

  function traverseNode(node: any): void {
    if (node.type === 'TEXT') {
      const boundVariables = node.boundVariables;
      if (boundVariables) {
        for (const bindings of Object.values(boundVariables)) {
          const bindingArray = Array.isArray(bindings) ? bindings : [bindings];
          for (const binding of bindingArray) {
            if (binding && typeof binding === 'object' && binding.id === tokenId) {
              layerIds.push(node.id);
              return;
            }
          }
        }
      }
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverseNode(child);
      }
    }
  }

  // Start traversal from root
  if (figma.root) {
    traverseNode(figma.root);
  }

  return layerIds;
}

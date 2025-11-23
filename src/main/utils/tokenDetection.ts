import type { DesignToken, TextLayer, TokenBinding } from '@/shared/types';

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
 * @param tokenType - Token type classification
 * @returns Formatted string representation
 */
function formatTokenValue(value: any, tokenType?: string): string {
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
 * Get token type from Figma variable
 * @param variable - Figma variable object
 * @returns Token type (color | number | string | boolean)
 */
function getTokenType(variable: any): 'color' | 'number' | 'string' | 'boolean' {
  if (!variable.resolvedType) {
    return 'string';
  }
  const type = variable.resolvedType.toLowerCase();
  if (type === 'color') return 'color';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
}

/**
 * Extract token modes if variable supports multiple modes
 *
 * @param variable - Figma variable object
 * @returns Map of mode ID → value, or empty object for single-mode tokens
 */
function extractTokenModes(variable: any): Record<string, string | number | boolean> {
  try {
    const modes = variable.valuesByMode;
    if (!modes || Object.keys(modes).length <= 1) {
      return {}; // Single mode or no modes
    }

    // Multi-mode token - return mode information
    const modeMap: Record<string, string | number | boolean> = {};
    for (const [_modeId, value] of Object.entries(modes)) {
      // For now, store string representations
      // In future, could preserve typed values
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        modeMap[_modeId] = value;
      } else {
        modeMap[_modeId] = formatTokenValue(value, variable.resolvedType);
      }
    }
    return modeMap;
  } catch (error) {
    return {};
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
          const tokenType = getTokenType(variable);

          const token: DesignToken = {
            id: variable.id,
            name: variable.name,
            key: `${collection.id}/${variable.id}`,
            type: tokenType,
            resolvedType: tokenType,
            currentValue: firstValue,
            value: firstValue,
            collectionId: collection.id,
            collectionName: collection.name,
            collections: [collection.name],
            modeId: firstModeId,
            modeName: 'Default',
            valuesByMode: variable.valuesByMode || { [firstModeId]: firstValue },
            modes: extractTokenModes(variable),
            isAlias: false,
            usageCount: 0,
            layerIds: [],
            propertyTypes: [],
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
 * Detect token bindings on a text layer
 *
 * @param node - Figma TextNode
 * @param tokenMap - Map of token IDs to tokens for quick lookup
 * @returns Array of token bindings
 */
export function detectTokenBindings(node: any, tokenMap: Map<string, DesignToken>): TokenBinding[] {
  const bindings: TokenBinding[] = [];

  try {
    if (!node.boundVariables) {
      return bindings;
    }

    // Enumerate all bound variables on this node
    for (const [propertyName, variableBindings] of Object.entries(node.boundVariables)) {
      const bindingsArray = Array.isArray(variableBindings) ? variableBindings : [variableBindings];

      for (const binding of bindingsArray) {
        if (binding && typeof binding === 'object' && 'id' in binding) {
          const token = tokenMap.get(binding.id);
          if (token) {
            bindings.push({
              property: propertyName as
                | 'fills'
                | 'fontFamily'
                | 'fontSize'
                | 'lineHeight'
                | 'letterSpacing',
              tokenId: token.id,
              tokenName: token.name,
              tokenValue: token.value,
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Error detecting token bindings for node ${node.id}:`, error);
  }

  return bindings;
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

/**
 * Integrate token usage into text layers
 *
 * Updates each layer with detected token bindings by fetching node data.
 *
 * @param layers - Text layers to augment with token data
 * @param tokens - All detected tokens in the document
 */
export async function integrateTokenUsageIntoLayers(
  layers: TextLayer[],
  tokens: DesignToken[]
): Promise<void> {
  // Create a map of token IDs to tokens for quick lookup
  const tokenMap = new Map(tokens.map((t) => [t.id, t]));

  // For each layer, detect which tokens it uses
  for (const layer of layers) {
    try {
      // Get the Figma node for detailed analysis
      const node = await figma.getNodeByIdAsync(layer.id);
      if (node && 'boundVariables' in node) {
        // Detect token bindings on this node
        layer.tokens = detectTokenBindings(node, tokenMap);

        // Update token usage counts
        for (const binding of layer.tokens) {
          const token = tokenMap.get(binding.tokenId);
          if (token) {
            token.usageCount++;
            if (!token.layerIds.includes(layer.id)) {
              token.layerIds.push(layer.id);
            }
            if (!token.propertyTypes.includes(binding.property)) {
              token.propertyTypes.push(binding.property);
            }
          }
        }
      }
    } catch (error) {
      // Skip this layer if we can't fetch node data
      console.warn(`Error integrating token usage for layer ${layer.id}:`, error);
    }
  }
}

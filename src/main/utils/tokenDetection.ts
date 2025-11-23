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
 * Detect all design tokens used in a text layer
 *
 * @param node - Text node to analyze
 * @returns Array of detected tokens with full metadata
 */
export async function detectTokensInLayer(node: any): Promise<DesignToken[]> {
  try {
    // Get bound variables from the text node
    const boundVariables = node.boundVariables;
    if (!boundVariables || Object.keys(boundVariables).length === 0) {
      return [];
    }

    const detectedTokens: DesignToken[] = [];
    const tokenIds = new Set<string>();

    // Iterate through bound variables (can have multiple per property)
    for (const [propertyName, variableBindings] of Object.entries(boundVariables)) {
      // variableBindings can be a single variable or array of variables
      const bindings = Array.isArray(variableBindings) ? variableBindings : [variableBindings];

      for (const binding of bindings) {
        if (!binding || !binding.id) {
          continue;
        }

        // Skip if we've already processed this token (avoid duplicates)
        if (tokenIds.has(binding.id)) {
          continue;
        }
        tokenIds.add(binding.id);

        // Resolve token metadata
        const token = await resolveTokenMetadata(binding.id, propertyName);
        if (token) {
          detectedTokens.push(token);
        }
      }
    }

    return detectedTokens;
  } catch (error) {
    // Log error but don't throw - allow audit to continue
    console.warn(`Error detecting tokens in layer ${node.id}:`, error);
    return [];
  }
}

/**
 * Resolve complete token metadata from token ID
 *
 * @param tokenId - Figma variable ID
 * @param boundProperty - Property the token is bound to (e.g., 'fills', 'fontFamily')
 * @returns Token metadata or null if token not found
 */
async function resolveTokenMetadata(
  tokenId: string,
  boundProperty: string
): Promise<DesignToken | null> {
  try {
    // Get the variable from Figma's variables API
    const variable = await figma.variables.getVariableByIdAsync(tokenId);
    if (!variable) {
      return null;
    }

    // Determine token type based on bound property and variable type
    const tokenTypeStr = determineTokenType(boundProperty, variable);
    const tokenType = tokenTypeStr as 'color' | 'typography' | 'sizing' | 'spacing' | 'custom';

    // Get the token value (may vary by mode)
    const modeIds = Object.keys(variable.valuesByMode);
    const defaultModeId = modeIds[0];
    const tokenValue = variable.valuesByMode[defaultModeId];

    // Build token metadata
    const token: DesignToken = {
      id: variable.id,
      name: variable.name,
      collection: variable.getVariableCollectionId ? 'default' : 'local',
      value: formatTokenValue(tokenValue, tokenType),
      type: tokenType,
      usageCount: 1, // Will be aggregated during audit processing
      layerIds: [],
      modes: extractTokenModes(variable),
    };

    return token;
  } catch (error) {
    console.warn(`Error resolving token metadata for ${tokenId}:`, error);
    return null;
  }
}

/**
 * Determine token type based on property name and variable type
 *
 * @param propertyName - Figma property name (e.g., 'fills', 'fontSize')
 * @param variable - Figma variable object
 * @returns Token type classification as string
 */
function determineTokenType(propertyName: string, variable: any): string {
  const resolvedType = variable.resolvedType || '';

  // Map by property name (most reliable)
  if (propertyName.includes('fill') || propertyName.includes('color')) {
    return 'color';
  }
  if (propertyName.includes('font') || propertyName.includes('typography')) {
    return 'typography';
  }
  if (
    propertyName.includes('size') ||
    propertyName.includes('width') ||
    propertyName.includes('height')
  ) {
    return 'sizing';
  }
  if (
    propertyName.includes('spacing') ||
    propertyName.includes('padding') ||
    propertyName.includes('margin')
  ) {
    return 'spacing';
  }

  // Map by variable resolved type (fallback)
  if (resolvedType === 'COLOR') {
    return 'color';
  }
  if (resolvedType === 'STRING') {
    return 'typography';
  }
  if (resolvedType === 'FLOAT') {
    return 'sizing';
  }

  return 'custom';
}

/**
 * Format token value for display
 *
 * @param value - Raw token value from Figma
 * @param tokenType - Token type classification
 * @returns Formatted string representation
 */
function formatTokenValue(value: any, tokenType: string): string {
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
    const tokens: DesignToken[] = [];
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

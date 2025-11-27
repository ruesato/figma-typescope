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
    console.log('[TokenDetection] Starting token detection...');

    // Step 1: Get all LOCAL variables
    try {
      console.log('[TokenDetection] Fetching all local variables...');
      const localVariables = await figma.variables.getLocalVariablesAsync();
      console.log(`[TokenDetection] Found ${localVariables.length} local variables`);

      // Get local collections for metadata
      const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
      const collectionMap = new Map<string, string>();
      for (const collection of localCollections) {
        collectionMap.set(collection.id, collection.name);
      }

      for (const variable of localVariables) {
        if (!tokenMap.has(variable.id)) {
          const firstModeId = Object.keys(variable.valuesByMode)[0];
          const firstValue = variable.valuesByMode[firstModeId];
          const tokenType = getTokenType(variable);
          const collectionName = collectionMap.get(variable.variableCollectionId) || 'Unknown';

          const token: DesignToken = {
            id: variable.id,
            name: variable.name,
            key: `local/${variable.id}`,
            type: tokenType,
            resolvedType: tokenType,
            currentValue: firstValue,
            value: firstValue,
            collectionId: variable.variableCollectionId,
            collectionName: collectionName,
            collections: [collectionName],
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
      console.log(`[TokenDetection] Processed local variables, tokenMap size: ${tokenMap.size}`);
    } catch (error) {
      console.warn('Error getting local variables:', error);
    }

    // Step 2: Get all LIBRARY variable collections (from linked libraries)
    try {
      console.log('[TokenDetection] Checking if figma.teamLibrary is available...');
      if (figma.teamLibrary) {
        console.log(
          '[TokenDetection] figma.teamLibrary is available, fetching library collections...'
        );
        const libraryCollections =
          await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
        console.log(`[TokenDetection] Found ${libraryCollections.length} library collections`);

        for (const libraryCollection of libraryCollections) {
          try {
            console.log(
              `[TokenDetection] Processing library collection: ${libraryCollection.name} (key: ${libraryCollection.key})`
            );
            const libraryVariables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(
              libraryCollection.key
            );
            console.log(
              `[TokenDetection] Found ${libraryVariables.length} variables in collection "${libraryCollection.name}"`
            );

            for (const variable of libraryVariables) {
              try {
                // LibraryVariable has a 'key' property, not 'id'
                // The key format is: "libraryId/collectionId/variableId"
                // When bound to layers, boundVariables uses the actual variableId
                const variableKey = variable.key;

                // Extract the actual variable ID from the key (last segment)
                const keyParts = variableKey.split('/');
                const actualVariableId = keyParts[keyParts.length - 1]; // e.g., "VariableID:123:456"

                // Check if we've already processed this variable (by either key or ID)
                if (!tokenMap.has(variableKey) && !tokenMap.has(actualVariableId)) {
                  // Debug logging for first few tokens to see structure
                  if (tokenMap.size < 10) {
                    console.log(`[TokenDetection] Processing library variable:`, {
                      name: variable.name,
                      key: variable.key,
                      actualVariableId: actualVariableId,
                      resolvedType: variable.resolvedType,
                    });
                  }

                  const tokenType = variable.resolvedType
                    ? (variable.resolvedType.toLowerCase() as
                        | 'color'
                        | 'number'
                        | 'string'
                        | 'boolean')
                    : 'string';

                  // LibraryVariable has limited data - we only have name, key, and resolvedType
                  // We don't have access to the actual value without importing it
                  const token: DesignToken = {
                    id: actualVariableId, // Use the actual variable ID (for binding lookups)
                    name: variable.name,
                    key: variableKey, // Keep the full key for reference
                    type: tokenType,
                    resolvedType: tokenType,
                    currentValue: '', // Placeholder - library variables don't expose values directly
                    value: '', // Placeholder value
                    collectionId: libraryCollection.key,
                    collectionName: libraryCollection.name,
                    collections: [libraryCollection.name],
                    modeId: 'default',
                    modeName: 'Default',
                    valuesByMode: {}, // Empty for library variables
                    modes: {},
                    isAlias: false,
                    usageCount: 0,
                    layerIds: [],
                    propertyTypes: [],
                  };

                  // Store by BOTH the variable ID (for binding lookups) AND the key (for reference)
                  tokenMap.set(actualVariableId, token);
                  // Also store by key for backwards compatibility
                  tokenMap.set(variableKey, token);
                }
              } catch (error) {
                console.warn(`Error processing library variable ${variable?.name}:`, error);
              }
            }
          } catch (error) {
            console.warn(
              `Error getting variables for library collection ${libraryCollection.name}:`,
              error
            );
          }
        }
      } else {
        console.log('[TokenDetection] figma.teamLibrary is NOT available (undefined or null)');
      }
    } catch (error) {
      console.warn('Error getting library variable collections:', error);
    }

    const tokens = Array.from(tokenMap.values());
    console.log(`[TokenDetection] Token detection complete. Total tokens found: ${tokens.length}`);
    return tokens;
  } catch (error) {
    console.error('[TokenDetection] Fatal error during token detection:', error);
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

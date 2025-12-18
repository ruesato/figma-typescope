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
 * Figma uses 'FLOAT' for number types, so we normalize it to 'number'
 * @param variable - Figma variable object
 * @returns Token type (color | number | string | boolean)
 */
function getTokenType(variable: any): 'color' | 'number' | 'string' | 'boolean' {
  if (!variable.resolvedType) {
    return 'string';
  }
  // Ensure resolvedType is a string (Figma API sometimes returns objects)
  const resolvedTypeStr = typeof variable.resolvedType === 'string'
    ? variable.resolvedType
    : String(variable.resolvedType);
  const type = resolvedTypeStr.toLowerCase();
  return type === 'color' ? 'color' :
    type === 'float' || type === 'number' ? 'number' :
    type === 'boolean' ? 'boolean' :
    'string';
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

    // Step 1: Get all LOCAL variables
    try {
      const localVariables = await figma.variables.getLocalVariablesAsync();

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

          // Try to get collection name from map, or fetch it if not found
          let collectionName = collectionMap.get(variable.variableCollectionId);

          if (!collectionName) {
            // Collection not in local map - might be a remote collection
            try {
              const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
              if (collection) {
                collectionName = collection.name || 'Variable collection';
              } else {
                collectionName = 'Unknown';
              }
            } catch (error) {
              collectionName = 'Unknown';
            }
          }

          const token: DesignToken = {
            id: variable.id,
            name: variable.name,
            key: `local/${variable.id}`,
            type: tokenType,
            resolvedType: String(tokenType), // Ensure string for React rendering
            currentValue: firstValue,
            value: firstValue,
            collectionId: variable.variableCollectionId,
            collectionName: `${collectionName} (local)`,
            collections: [`${collectionName} (local)`],
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
    } catch (error) {
      console.warn('Error getting local variables:', error);
    }

    // Step 2: Get all LIBRARY variable collections (from linked libraries)
    try {
      if (figma.teamLibrary) {
        const libraryCollections =
          await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

        // WORKAROUND: If getAvailableLibraryVariableCollectionsAsync returns 0,
        // try to discover remote collections by scanning all variables in the document
        if (libraryCollections.length === 0) {
          // Get all variable collections (both local and remote)
          const allCollections: any[] = [];

          // Scan all pages for variable usage to discover remote collections
          const remoteCollectionIds = new Set<string>();

          for (const page of figma.root.children) {
            await page.loadAsync();
            const nodes = page.findAll((node: any) => {
              return node.type === 'TEXT' && node.boundVariables;
            });

            for (const node of nodes) {
              const textNode = node as any;
              if (textNode.boundVariables) {
                for (const [_prop, binding] of Object.entries(textNode.boundVariables)) {
                  const bindingsArray = Array.isArray(binding) ? binding : [binding];
                  for (const b of bindingsArray) {
                    if (b && typeof b === 'object' && 'id' in b) {
                      try {
                        const variable = await figma.variables.getVariableByIdAsync(b.id);
                        if (variable && variable.variableCollectionId) {
                          remoteCollectionIds.add(variable.variableCollectionId);
                        }
                      } catch (error) {
                        // Variable might be deleted or inaccessible
                      }
                    }
                  }
                }
              }
            }
          }

          // Fetch each discovered collection
          for (const collectionId of remoteCollectionIds) {
            try {
              const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
              if (collection && collection.remote) {
                allCollections.push({
                  name: collection.name,
                  key: collection.key,
                  id: collection.id
                });
              }
            } catch (error) {
              console.warn(`[TokenDetection] Failed to fetch collection ${collectionId}:`, error);
            }
          }

          // Use discovered collections
          libraryCollections.push(...allCollections);
        }

        for (const libraryCollection of libraryCollections) {
          try {
            const libraryVariables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(
              libraryCollection.key
            );

            for (const variable of libraryVariables) {
              try {
                // LibraryVariable has a 'key' property in format: "S:libraryId,collectionId:variableId"
                // But boundVariables binding.id uses format: "VariableID:hash/collectionId:varId"
                // We need to use variable.key as the primary ID since that's what we have access to
                const variableKey = variable.key;

                // Check if we've already processed this variable
                if (!tokenMap.has(variableKey)) {
                  // Use getTokenType to properly normalize FLOAT -> number
                  const tokenType = getTokenType(variable);

                  // Try to fetch the actual variable to get its values
                  let currentValue: any = '';
                  let valuesByMode: Record<string, any> = {};
                  let modes: Record<string, any> = {};
                  let modeId = 'default';
                  let modeName = 'Default';

                  try {
                    // For library variables, we need to import them to access their values
                    // The key format is "S:libraryId,collectionId:variableId"
                    const importedVariable = await figma.variables.importVariableByKeyAsync(
                      variableKey
                    );
                    if (importedVariable && importedVariable.valuesByMode) {
                      const firstModeId = Object.keys(importedVariable.valuesByMode)[0];
                      currentValue = importedVariable.valuesByMode[firstModeId];
                      valuesByMode = importedVariable.valuesByMode;
                      modeId = firstModeId;

                      // Convert valuesByMode to modes with mode names
                      const collection = await figma.variables.getVariableCollectionByIdAsync(
                        importedVariable.variableCollectionId
                      );
                      if (collection) {
                        for (const [mId, value] of Object.entries(importedVariable.valuesByMode)) {
                          const mode = collection.modes.find((m) => m.modeId === mId);
                          modes[mode?.name || mId] = value;
                        }
                        // Get current mode name
                        const currentMode = collection.modes.find((m) => m.modeId === firstModeId);
                        modeName = currentMode?.name || 'Default';
                      }
                    }
                  } catch (fetchError) {
                    // If we can't import the variable, fall back to empty values
                  }

                  const token: DesignToken = {
                    id: variableKey, // Use the library key as the ID
                    name: variable.name,
                    key: variableKey,
                    type: tokenType,
                    resolvedType: String(tokenType), // Ensure string for React rendering
                    currentValue,
                    value: currentValue,
                    collectionId: libraryCollection.key,
                    collectionName: `${String(libraryCollection.name || 'Variable collection')} (remote)`,
                    collections: [`${String(libraryCollection.name || 'Variable collection')} (remote)`],
                    modeId,
                    modeName,
                    valuesByMode,
                    modes,
                    isAlias: false,
                    usageCount: 0,
                    layerIds: [],
                    propertyTypes: [],
                  };

                  // Store by the library key
                  tokenMap.set(variableKey, token);

                  // ALSO store by the potential binding ID format
                  // Binding format observed: VariableID:hash/collectionId:varId
                  // Try using the collection key as the hash part
                  const bindingIdFormat = `VariableID:${libraryCollection.key}/${variableKey}`;
                  tokenMap.set(bindingIdFormat, token);
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
      }
    } catch (error) {
      console.warn('Error getting library variable collections:', error);
    }

    return Array.from(tokenMap.values());
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
 * @param tokens - Optional array to add newly discovered tokens to
 * @returns Array of token bindings
 */
export async function detectTokenBindings(
  node: any,
  tokenMap: Map<string, DesignToken>,
  tokens?: DesignToken[]
): Promise<TokenBinding[]> {
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
          const bindingId = binding.id;
          let token = tokenMap.get(bindingId);

          // If not found in the map, try to fetch it directly from Figma API
          if (!token) {
            try {
              const variable = await figma.variables.getVariableByIdAsync(bindingId);
              if (variable) {
                // Successfully fetched the variable - create a token object for it
                // Use getTokenType to properly normalize FLOAT -> number
                const tokenType = getTokenType(variable);

                const firstModeId = Object.keys(variable.valuesByMode)[0];
                const firstValue = variable.valuesByMode[firstModeId];

                token = {
                  id: bindingId,
                  name: variable.name,
                  key: bindingId,
                  type: tokenType,
                  resolvedType: String(tokenType), // Ensure string for React rendering
                  currentValue: firstValue,
                  value: firstValue,
                  collectionId: variable.variableCollectionId,
                  collectionName: 'Library', // Placeholder
                  collections: ['Library'],
                  modeId: firstModeId,
                  modeName: 'Default',
                  valuesByMode: variable.valuesByMode || { [firstModeId]: firstValue },
                  modes: {},
                  isAlias: false,
                  usageCount: 0,
                  layerIds: [],
                  propertyTypes: [],
                };

                // Cache it for future lookups
                tokenMap.set(bindingId, token);

                // Add to tokens array if provided
                if (tokens) {
                  tokens.push(token);
                }
              }
            } catch (error) {
              // Variable not found - might be deleted
            }
          }

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
        const allBindings = await detectTokenBindings(node, tokenMap, tokens);

        // Filter to only keep the ACTIVE bindings (last binding per property)
        // When a property has multiple bindings like [bindingA, bindingB],
        // only bindingB is active (it overrides bindingA)
        const bindingsByProperty = new Map<string, TokenBinding>();
        for (const binding of allBindings) {
          // Keep the last binding for each property (it overwrites previous ones)
          bindingsByProperty.set(binding.property, binding);
        }

        // Only store active bindings on the layer
        layer.tokens = Array.from(bindingsByProperty.values());

        // Update token usage counts - ONLY for active bindings
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

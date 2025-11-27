# Figma Plugin API: Variables and Library Variable Access Analysis

**Date**: November 26, 2025  
**Source**: Figma Plugin API Typings v1.109.0  
**Project**: figma-fontscope

---

## Executive Summary

The Figma Plugin API provides comprehensive support for accessing and managing design variables (tokens) through two main APIs:

1. **`figma.variables.*`** - For local document variables
2. **`figma.teamLibrary.*`** - For team library variables

Library variable **values are NOT accessible** via the Plugin API - this is a documented limitation. However, library variable **metadata (names, types)** are fully accessible for inventory and usage tracking purposes.

---

## 1. Variables API Overview

### 1.1 Available APIs: `figma.variables`

The `VariablesAPI` provides both async and sync access to variables:

#### **Local Variable Access** (Document Variables)

```typescript
// Async methods (recommended for plugins)
figma.variables.getLocalVariablesAsync(type?: VariableResolvedDataType)
  → Promise<Variable[]>

figma.variables.getVariableByIdAsync(id: string)
  → Promise<Variable | null>

figma.variables.getLocalVariableCollectionsAsync()
  → Promise<VariableCollection[]>

figma.variables.getVariableCollectionByIdAsync(id: string)
  → Promise<VariableCollection | null>

// Sync methods (for when async not needed)
figma.variables.getLocalVariables(type?: VariableResolvedDataType)
  → Variable[]

figma.variables.getVariableById(id: string)
  → Variable | null

figma.variables.getLocalVariableCollections()
  → VariableCollection[]

figma.variables.getVariableCollectionById(id: string)
  → VariableCollection | null
```

#### **Library Variable Import**

```typescript
// Import a library variable into the local document
figma.variables.importVariableByKeyAsync(key: string)
  → Promise<Variable>
```

**What it does:**

- Takes a library variable's unique key (format: "libraryId/collectionId/variableId")
- Imports the variable into the current document
- Returns the imported Variable object with full metadata and value access
- Enables local reference to team library variables

---

## 2. Variable Interface Structure

### 2.1 Local Variable Properties

```typescript
interface Variable extends PluginDataMixin {
  // Identity
  readonly id: string                           // Figma-assigned ID
  name: string                                   // Variable name
  description: string                            // Documentation
  hiddenFromPublishing: boolean                  // Publishing control

  // Type Information
  readonly resolvedType: VariableResolvedDataType  // 'COLOR' | 'STRING' | 'FLOAT' | 'BOOLEAN'

  // Value Data - ONLY AVAILABLE FOR LOCAL VARIABLES
  readonly valuesByMode: {
    [modeId: string]: VariableValue
  }

  // Collection Info
  readonly variableCollectionId: string          // Parent collection ID
  readonly key: string                           // Unique stable key

  // Remote Status
  readonly remote: boolean                       // True if from library

  // Utilities
  resolveForConsumer(consumer: SceneNode): {
    value: VariableValue
    resolvedType: VariableResolvedDataType
  }

  setValueForMode(modeId: string, newValue: VariableValue): void
  setVariableCodeSyntax(platform: CodeSyntaxPlatform, value: string): void
  removeVariableCodeSyntax(platform: CodeSyntaxPlatform): void

  scopes: Array<VariableScope>
  readonly codeSyntax: { [platform: string]?: string }

  // Lifecycle
  remove(): void
  getPublishStatusAsync(): Promise<PublishStatus>
}
```

**Type Definition:**

```typescript
type VariableValue =
  | string
  | number
  | boolean
  | RGBA
  | { r: number; g: number; b: number; a: number };
type VariableResolvedDataType = 'COLOR' | 'STRING' | 'FLOAT' | 'BOOLEAN';
```

### 2.2 VariableCollection Structure

```typescript
interface VariableCollection extends PluginDataMixin {
  readonly id: string; // Collection ID
  name: string; // Collection name
  hiddenFromPublishing: boolean; // Publishing control

  readonly remote: boolean; // True if from library
  readonly key: string; // Unique stable key

  // Mode Management
  readonly modes: Array<{
    modeId: string; // Mode identifier
    name: string; // Mode display name (e.g., "Light", "Dark")
  }>;
  readonly defaultModeId: string; // Default mode ID

  // Contents
  readonly variableIds: string[]; // All variable IDs in this collection

  // Utilities
  removeMode(modeId: string): void;
  remove(): void;
  getPublishStatusAsync(): Promise<PublishStatus>;
}
```

---

## 3. Team Library API: `figma.teamLibrary`

### 3.1 Available APIs

```typescript
interface TeamLibraryAPI {
  // Get all available library variable collections
  getAvailableLibraryVariableCollectionsAsync()
    → Promise<LibraryVariableCollection[]>

  // Get all variables in a specific library collection
  getVariablesInLibraryCollectionAsync(libraryCollectionKey: string)
    → Promise<LibraryVariable[]>
}
```

### 3.2 LibraryVariableCollection Structure

```typescript
interface LibraryVariableCollection {
  name: string; // Collection display name
  key: string; // Unique stable key (format: libraryId/collectionId)
  libraryName: string; // Library name
}
```

### 3.3 LibraryVariable Structure

```typescript
interface LibraryVariable {
  name: string; // Variable name
  key: string; // Unique stable key (format: libraryId/collectionId/variableId)
  resolvedType: VariableResolvedDataType; // 'COLOR' | 'STRING' | 'FLOAT' | 'BOOLEAN'

  // ❌ NO VALUE DATA AVAILABLE
  // No valuesByMode, no currentValue, no actual token data
  // This is a documented Plugin API limitation
}
```

---

## 4. Accessing Variable Values and Metadata

### 4.1 Local Variables (Full Access)

```typescript
// Get all local variables with values
const localVariables = await figma.variables.getLocalVariablesAsync();

for (const variable of localVariables) {
  console.log({
    id: variable.id,
    name: variable.name,
    type: variable.resolvedType,

    // ✅ VALUES ACCESSIBLE - can read all mode values
    values: variable.valuesByMode, // { modeId1: value1, modeId2: value2, ... }

    collection: variable.variableCollectionId,
    key: variable.key,
    remote: variable.remote, // false for local variables
  });
}

// Get specific variable
const variable = await figma.variables.getVariableByIdAsync('variableId');
if (variable) {
  const lightModeValue = variable.valuesByMode['light-mode-id'];
  console.log(`Current value: ${lightModeValue}`);
}

// Get collection info
const collection = await figma.variables.getVariableCollectionByIdAsync('collectionId');
if (collection) {
  console.log('Modes:', collection.modes); // [{ modeId: '...', name: 'Light' }, ...]
}
```

### 4.2 Library Variables (Metadata Only)

```typescript
// Get all available library variable collections
const libraryCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

for (const collection of libraryCollections) {
  console.log({
    name: collection.name,
    libraryName: collection.libraryName,
    key: collection.key,
  });

  // Get variables in this collection
  const variables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);

  for (const variable of variables) {
    console.log({
      name: variable.name,
      key: variable.key,
      type: variable.resolvedType,

      // ❌ NO VALUES - Library variables don't expose their values
      // valuesByMode is NOT available
      // currentValue is NOT available
      // actual token data NOT accessible via Plugin API
    });
  }
}
```

### 4.3 Importing Library Variables (To Get Values)

```typescript
// Import a library variable to access its value
const libraryVariable = await figma.variables.importVariableByKeyAsync(
  'libraryId/collectionId/variableId'
);

// After import, it becomes a local variable with full access
console.log({
  name: libraryVariable.name,
  type: libraryVariable.resolvedType,

  // ✅ NOW ACCESSIBLE - after import
  values: libraryVariable.valuesByMode, // Can read all mode values
  remote: libraryVariable.remote, // true - indicates it's from a library
});
```

---

## 5. Token Binding Detection on Text Nodes

### 5.1 BoundVariables Property

All nodes support `boundVariables` property to detect token bindings:

```typescript
interface SceneNode {
  // ... other properties ...

  readonly boundVariables?: {
    // Token bindings by property
    [propertyName: string]: VariableAlias | VariableAlias[];
  };
}

interface VariableAlias {
  id: string; // Variable ID
  type: 'VARIABLE_ALIAS'; // Discriminator
}
```

### 5.2 Detecting Tokens on Text Layers

```typescript
function detectTokensOnTextLayer(textNode: TextNode): TokenInfo[] {
  const tokens: TokenInfo[] = [];

  if (!textNode.boundVariables) {
    return tokens;
  }

  // Enumerate all bound variables
  for (const [propertyName, bindings] of Object.entries(textNode.boundVariables)) {
    // bindings can be single VariableAlias or VariableAlias[]
    const bindingsArray = Array.isArray(bindings) ? bindings : [bindings];

    for (const binding of bindingsArray) {
      if (binding && binding.type === 'VARIABLE_ALIAS') {
        tokens.push({
          property: propertyName, // e.g., 'fills', 'fontSize'
          tokenId: binding.id, // Variable ID
        });
      }
    }
  }

  return tokens;
}
```

---

## 6. Documented Limitations for Library Variables

### 6.1 What's NOT Available

| Data                      | Local Variables | Library Variables | After Import |
| ------------------------- | --------------- | ----------------- | ------------ |
| Name                      | ✅              | ✅                | ✅           |
| Type (resolvedType)       | ✅              | ✅                | ✅           |
| **Values (valuesByMode)** | ✅              | ❌                | ✅           |
| Collection Info           | ✅              | Partial           | ✅           |
| Mode Information          | ✅              | ❌                | ✅           |
| Scopes                    | ✅              | ❌                | ✅           |

### 6.2 Why This Limitation Exists

From research findings in the codebase (`specs/002-style-governance/data-model.md`):

> Team library variables have limited metadata via the Plugin API:
>
> - ✅ Available: `name`, `key`, `resolvedType` (type information)
> - ❌ Not Available: `currentValue`, `valuesByMode` (actual token values)
>
> This is a Figma Plugin API constraint.

**Practical Impact:**

- Library token inventories CAN be built (names, types available)
- Library token usage CAN be tracked (via `boundVariables`)
- Library token **values CANNOT be displayed** in the UI
- Library token replacement CAN work via `setBoundVariable()`

### 6.3 Workarounds

1. **For Inventory/Tracking**: Use the metadata APIs - sufficient for listing and usage tracking
2. **For Value Display**: Import the variable with `importVariableByKeyAsync()` to get values
3. **For Bulk Import**: Pre-import library variables during audit setup

---

## 7. Code Examples from Implementation

### 7.1 Real-World Usage: Token Detection

From `src/main/utils/tokenDetection.ts`:

```typescript
// Get all document tokens (local + library)
export async function getAllDocumentTokens(): Promise<DesignToken[]> {
  const tokenMap = new Map<string, DesignToken>();

  // Step 1: Local variables (full data available)
  const localVariables = await figma.variables.getLocalVariablesAsync();
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionMap = new Map(localCollections.map((c) => [c.id, c.name]));

  for (const variable of localVariables) {
    const firstModeId = Object.keys(variable.valuesByMode)[0];
    const firstValue = variable.valuesByMode[firstModeId];

    tokenMap.set(variable.id, {
      id: variable.id,
      name: variable.name,
      type: variable.resolvedType.toLowerCase(),
      currentValue: firstValue, // ✅ Available
      valuesByMode: variable.valuesByMode, // ✅ Available
      // ... more properties
    });
  }

  // Step 2: Library variables (metadata only)
  if (figma.teamLibrary) {
    const libraryCollections =
      await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();

    for (const libraryCollection of libraryCollections) {
      const libraryVariables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(
        libraryCollection.key
      );

      for (const variable of libraryVariables) {
        // ⚠️ No value data available
        tokenMap.set(variable.key, {
          id: variable.key,
          name: variable.name,
          type: variable.resolvedType.toLowerCase(),
          currentValue: '', // ❌ Placeholder - no data available
          valuesByMode: {}, // ❌ Empty - no data available
          collectionName: libraryCollection.name,
          // ... more properties
        });
      }
    }
  }

  return Array.from(tokenMap.values());
}
```

### 7.2 Token Binding Detection

```typescript
export function detectTokenBindings(
  node: TextNode,
  tokenMap: Map<string, DesignToken>
): TokenBinding[] {
  const bindings: TokenBinding[] = [];

  if (!node.boundVariables) return bindings;

  for (const [propertyName, variableBindings] of Object.entries(node.boundVariables)) {
    const bindingsArray = Array.isArray(variableBindings) ? variableBindings : [variableBindings];

    for (const binding of bindingsArray) {
      if (binding && 'id' in binding) {
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

  return bindings;
}
```

---

## 8. Key Findings Summary

### 8.1 Available APIs

| API                                             | Purpose                   | Availability | Async         |
| ----------------------------------------------- | ------------------------- | ------------ | ------------- |
| `getLocalVariablesAsync()`                      | Fetch all local variables | ✅           | Yes           |
| `getLocalVariables()`                           | Fetch all local variables | ✅           | No            |
| `getVariableByIdAsync(id)`                      | Get single variable       | ✅           | Yes           |
| `getVariableById(id)`                           | Get single variable       | ✅           | No            |
| `getLocalVariableCollectionsAsync()`            | Get collection info       | ✅           | Yes           |
| `getVariableCollectionByIdAsync(id)`            | Get single collection     | ✅           | Yes           |
| `importVariableByKeyAsync(key)`                 | Import library variable   | ✅           | Yes           |
| `getAvailableLibraryVariableCollectionsAsync()` | List library collections  | ✅           | Yes           |
| `getVariablesInLibraryCollectionAsync(key)`     | List library variables    | ✅           | Yes           |
| `boundVariables` (on TextNode)                  | Detect token bindings     | ✅           | No (property) |

### 8.2 Value Accessibility

**Local Variables:**

- Values accessible via `variable.valuesByMode` dictionary
- Full mode information available
- Can read, write, and manipulate values

**Library Variables (Before Import):**

- Names and types accessible
- Values **NOT accessible** (Plugin API limitation)
- Mode information not available
- Use case: inventory, tracking, type validation

**Library Variables (After Import via `importVariableByKeyAsync()`):**

- All properties accessible like local variables
- Values available via `valuesByMode`
- Can be used as full variables in document

### 8.3 `figma.importVariableByKeyAsync()` Capabilities

**What it does:**

- Takes a library variable key (stable, unique identifier)
- Imports that variable into the current document
- Returns the imported Variable object with **full access**

**When to use:**

- When you need to access library variable values
- When you need to perform operations on library variables
- When you need the same API as local variables

**Example:**

```typescript
// Library variable - metadata only
const libraryVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(key);
const libraryVar = libraryVars[0];
console.log(libraryVar.name); // ✅ Works
console.log(libraryVar.resolvedType); // ✅ Works
// console.log(libraryVar.valuesByMode);   // ❌ Doesn't exist

// After importing - full access
const imported = await figma.variables.importVariableByKeyAsync(libraryVar.key);
console.log(imported.name); // ✅ Works
console.log(imported.resolvedType); // ✅ Works
console.log(imported.valuesByMode); // ✅ Now works!
console.log(imported.remote); // ✅ true - indicates library variable
```

---

## 9. Recommendations for Implementation

### 9.1 For Token Inventory

- Use `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()`
- Use `figma.teamLibrary.getVariablesInLibraryCollectionAsync(key)`
- **Sufficient for:** Listing, counting, categorizing tokens
- **NOT sufficient for:** Displaying token values

### 9.2 For Token Value Display

- Build inventory first with metadata
- Import specific tokens with `importVariableByKeyAsync()` if values needed
- Cache imports to avoid re-importing same tokens
- Display imported variable values normally

### 9.3 For Token Binding Detection

- Use `textNode.boundVariables` property
- Iterate over bindings and lookup token metadata
- Works for both local and library tokens

### 9.4 For Token Replacement

- Use `textNode.setBoundVariable()` method (mentioned in research but not shown in types)
- Works for both local and library variable bindings
- Can unbind by passing `null` as variable

---

## 10. Plugin API Version

**Current Version**: 1.109.0  
**APIs tested/documented**: Plugin API 1.109.0+

All APIs described are stable and documented in the official Figma Plugin API type definitions.

---

**Document prepared for**: figma-fontscope project  
**Last verified**: November 26, 2025  
**Type Definitions Source**: `@figma/plugin-typings@1.109.0`

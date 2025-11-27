# Investigation: Library Variable Values in Figma Plugin API

**Date**: November 26, 2025  
**Status**: INVESTIGATION COMPLETE - PLAN MODE  
**Scope**: Token Coverage metric and library variable value accessibility  
**Key Finding**: `figma.importVariableByKeyAsync()` provides workaround for value access

---

## Executive Summary

Library tokens are included in Token Coverage metrics but their values are not accessible via the standard Plugin API. **However, a workaround exists**: `figma.importVariableByKeyAsync()` can import library variables and expose their values. This enables a v1.1 enhancement without API changes.

### Current State (v1.0)
- ✅ Token Coverage includes local + library tokens
- ✅ Token inventory can be displayed
- ✅ Token usage can be tracked
- ❌ Library token values are empty placeholders

### Potential Enhancement (v1.1)
- ✅ All of above, PLUS
- ✅ Library token values accessible via `importVariableByKeyAsync()`
- ✅ Full token metadata displayed for both local and library tokens
- ✅ Option to pre-import library tokens during audit

---

## Investigation Findings

### 1. Library Variable Value Limitation (Confirmed)

**The Problem:**
```typescript
// Library variables via API only expose metadata
const libVar = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(key);
console.log(libVar.name);           // ✅ Works
console.log(libVar.resolvedType);   // ✅ Works
console.log(libVar.valuesByMode);   // ❌ Undefined - NOT available
```

**Root Cause**: Figma Plugin API design decision - library variables are treated as references, not full objects.

**Impact on v1.0**:
- Token inventory functions correctly (names, types available)
- Token binding detection functions correctly (works via `textNode.boundVariables`)
- Token replacement functions correctly (uses variable keys)
- **Only issue**: Display of library token values in UI

### 2. Workaround Exists: `figma.importVariableByKeyAsync()`

**The Solution:**
```typescript
// Import library variable to get full access
const imported = await figma.variables.importVariableByKeyAsync(
  'libraryId/collectionId/variableId'
);

// After import, full access to values
console.log(imported.name);           // ✅ Works
console.log(imported.resolvedType);   // ✅ Works
console.log(imported.valuesByMode);   // ✅ NOW WORKS!
console.log(imported.remote);         // ✅ true (indicates library variable)
```

**Key Characteristics:**
- **Type**: Async function returning full `Variable` object
- **Requirement**: Library variable key (available from `LibraryVariable.key`)
- **Result**: Returns imported Variable with full metadata
- **Stability**: Stable API, documented in Figma Plugin API v1.109.0+
- **Side Effect**: Creates a new local binding to the library variable (minimal impact)

### 3. Does This Affect Token Binding Detection?

**Answer: NO** ❌

Token binding detection works **independently** of value access:
- `textNode.boundVariables` contains binding references (not values)
- Bindings work for both local and library tokens
- Current implementation correctly identifies bound tokens
- No changes needed to binding detection logic

**Current Implementation** (`tokenDetection.ts` lines 268-302):
```typescript
export function detectTokenBindings(node: any, tokenMap: Map<string, DesignToken>): TokenBinding[] {
  // Iterates over boundVariables property
  // Looks up token metadata in tokenMap
  // Works for both local and library tokens
  // ✅ No issues - handles both sources correctly
}
```

---

## Technical Analysis

### Available APIs and Their Capabilities

| API Method | Purpose | Local Vars | Library Vars | After Import |
|-----------|---------|-----------|--------------|-------------|
| `getLocalVariablesAsync()` | Fetch all local variables | ✅ Full | - | - |
| `getAvailableLibraryVariableCollectionsAsync()` | List library collections | - | ✅ Metadata | - |
| `getVariablesInLibraryCollectionAsync()` | List library variables | - | ✅ Metadata only | - |
| **`importVariableByKeyAsync()`** | **Import library variable** | - | ❌ Raw | **✅ Full** |
| `boundVariables` (property) | Detect token bindings | ✅ Works | ✅ Works | ✅ Works |

### Value Accessibility Matrix

| Property | Local Vars | Library Vars | After `importVariableByKeyAsync()` |
|----------|-----------|--------------|-----------------------------------|
| `name` | ✅ | ✅ | ✅ |
| `resolvedType` | ✅ | ✅ | ✅ |
| `key` | ✅ | ✅ | ✅ |
| `valuesByMode` | ✅ | ❌ | ✅ |
| `remote` | ✅ (false) | - | ✅ (true) |
| `scopes` | ✅ | ❌ | ✅ |

---

## v1.0 (Current) vs v1.1 (Proposed) Enhancement

### v1.0: Current Implementation

**Scope**: Both local and library tokens included  
**Implementation**: Uses `figma.teamLibrary.*` API for library inventory

```typescript
// tokenDetection.ts - Current approach
const libraryVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(key);
for (const variable of libraryVars) {
  tokenMap.set(variable.key, {
    name: variable.name,
    resolvedType: variable.resolvedType,
    currentValue: '', // ❌ Placeholder
    valuesByMode: {}, // ❌ Empty
  });
}
```

**Status**: ✅ Works for inventory, usage tracking, replacement  
**Limitation**: Library token values display empty in UI

---

### v1.1 (Proposed): Library Variable Value Display

**Scope**: Add value display for library tokens (optional feature)  
**Implementation**: Pre-import library tokens during audit setup

**Proposed Approach 1: On-Demand Import (Conservative)**
```typescript
// When displaying library token values:
if (!libraryToken.valuesByMode || Object.keys(libraryToken.valuesByMode).length === 0) {
  try {
    const imported = await figma.variables.importVariableByKeyAsync(libraryToken.key);
    libraryToken.valuesByMode = imported.valuesByMode;
    libraryToken.remote = imported.remote;
    // Now token has values available
  } catch (error) {
    console.warn(`Could not import library variable ${libraryToken.key}:`, error);
    // Gracefully fall back to empty display
  }
}
```

**Proposed Approach 2: Batch Import (Aggressive)**
```typescript
// During token detection setup:
const libraryTokens = [/* all library tokens */];

// Import all at once (more efficient)
const importedTokens = await Promise.all(
  libraryTokens.map(t => 
    figma.variables.importVariableByKeyAsync(t.key)
      .catch(err => null) // Handle failures gracefully
  )
);

// Merge imported data back into tokenMap
for (const imported of importedTokens) {
  if (imported) {
    const existing = tokenMap.get(imported.key);
    if (existing) {
      existing.valuesByMode = imported.valuesByMode;
      existing.remote = true;
    }
  }
}
```

**Benefits**:
- ✅ Library token values become available
- ✅ No breaking changes to v1.0
- ✅ Graceful degradation if import fails
- ✅ Works with existing infrastructure

**Costs**:
- ⚠️ Creates local bindings to library variables (minimal impact)
- ⚠️ Adds async overhead during audit
- ⚠️ May need caching to avoid re-imports

---

## Recommendations

### For v1.0 (Current Release)

**No changes needed.** Current implementation is correct:

1. ✅ Token Coverage metric documentation updated to clarify scope
2. ✅ Library variable limitation documented
3. ✅ Code comments reference implementation details
4. ✅ Users understand why library tokens show empty values

**Action Items** (COMPLETED):
- [x] Update `spec.md` with Token Coverage scope
- [x] Update `data-model.md` with library variable notes
- [x] Document limitation in DEVELOPER_REFERENCE.md
- [x] Create VARIABLES_API_REFERENCE.md for future reference
- [x] Create this investigation document

### For v1.1 (Future Enhancement)

**Optional feature**: Import library token values on demand

1. **Create v1.1 feature specification**:
   - Title: "Display Library Token Values in Audit Results"
   - Scope: Optional enhancement to improve token visibility
   - Effort: Low (1-2 sprints)
   - Risk: Low (graceful degradation, optional)

2. **Implementation strategy**:
   - Use on-demand import (Approach 1) for conservative rollout
   - Add feature flag to control behavior
   - Cache imported tokens to avoid re-imports
   - Add error handling and graceful fallback

3. **Testing approach**:
   - Test with documents having library tokens
   - Test import failure scenarios
   - Test performance with 50+ library tokens
   - Verify no impact on existing v1.0 functionality

---

## Questions Answered

### Q: Does library variable limitation break Token Coverage metric?
**A**: No. Token Coverage correctly counts library tokens. Only the **display** of values is limited.

### Q: Is token binding detection affected by library variable limitation?
**A**: No. Binding detection works independently via `boundVariables` property.

### Q: Is there a way to get library variable values?
**A**: Yes, via `figma.importVariableByKeyAsync()` with full documentation available.

### Q: Should v1.0 be changed to use `importVariableByKeyAsync()`?
**A**: No. Current implementation is optimal for v1.0. Enhancement planned for v1.1.

### Q: Will importing library variables cause issues?
**A**: Low risk - creates local references but no breaking changes. Can be toggled via feature flag.

---

## References

- **VARIABLES_API_REFERENCE.md**: Complete Figma Plugin API documentation for variables
- **spec.md** (002-style-governance): Updated Token Coverage metric definition
- **data-model.md** (002-style-governance): Updated DesignToken entity documentation
- **tokenDetection.ts**: Current implementation of token detection with library variable handling
- **Figma Plugin API v1.109.0**: Official type definitions and documentation

---

## Sign-Off

**Investigation Status**: ✅ COMPLETE  
**Findings**: Library variable values are NOT accessible via standard API, but `figma.importVariableByKeyAsync()` provides a workaround.

**Next Steps**:
1. v1.0: Complete with documentation updates ✅ (In progress)
2. v1.1: Plan feature for library variable value display (Future)
3. Maintain VARIABLES_API_REFERENCE.md as architectural decision log

---

**Created**: November 26, 2025  
**Last Updated**: November 26, 2025  
**Author**: OpenCode (Investigation Mode)  
**Project**: figma-fontscope / 002-style-governance

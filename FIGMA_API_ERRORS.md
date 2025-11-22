# Figma Plugin Error Prevention Guide

Based on lessons learned from migrating figma-fontscope from @create-figma-plugin to Vite + vanilla Figma API.

## Critical Errors Encountered & Solutions

### Error 1: `figma.loadPageAsync is not a function`

**Symptom**: Runtime error when trying to load pages asynchronously

```
TypeError: figma.loadPageAsync is not a function
```

**Root Cause**: This API doesn't exist in the vanilla Figma Plugin API. It was likely from an older or different plugin toolkit.

**Solution**: Use direct node tree traversal instead:

```typescript
// ❌ Don't do this
for (const page of pages) {
  await figma.loadPageAsync(page); // NOT AVAILABLE
}

// ✅ Do this instead
function findTextNodesInPage(node: any): any[] {
  const textNodes: any[] = [];
  if (node.type === 'TEXT') {
    textNodes.push(node);
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      textNodes.push(...this.findTextNodesInPage(child));
    }
  }
  return textNodes;
}
```

### Error 2: `performance.now() is not a function`

**Symptom**: Runtime error when timing audit operations

```
TypeError: Cannot read properties of undefined (reading 'now')
```

**Root Cause**: `performance` global is not available in Figma plugin sandbox

**Solution**: Use `Date.now()` instead:

```typescript
// ❌ Don't do this
const start = performance.now();

// ✅ Do this instead
const start = Date.now();
const duration = Date.now() - start; // Returns milliseconds
```

### Error 3: Range errors on empty text nodes

**Symptom**: Multiple errors when processing text nodes

```
Error: in getRangeFontName: Range outside of available characters.
'start' must be less than node.characters.length
```

**Root Cause**: Code tries to call `getRangeFontName(0, 1)` on nodes with 0 characters

**Solution**: Always check character length before accessing character-level properties:

```typescript
// ❌ Don't do this
const fontName = node.getRangeFontName(0, 1); // Crashes on empty nodes

// ✅ Do this instead
if (node.characters && node.characters.length > 0) {
  const fontName = node.getRangeFontName(0, 1);
} else {
  // Skip or handle empty node
  continue;
}
```

## Figma Plugin Environment Constraints

### API Availability

**Always validate before use:**

```typescript
// Check Figma global exists
if (typeof figma === 'undefined') {
  throw new Error('Figma API not available');
}

// Check required properties
if (!figma.currentPage) {
  throw new Error('Cannot access current page');
}

if (!figma.root) {
  throw new Error('Cannot access document root');
}

if (!figma.ui || typeof figma.ui.postMessage !== 'function') {
  throw new Error('UI message handler not available');
}
```

### Async/Await Operations

**Known unavailable async APIs:**

- `figma.loadPageAsync()` - DOESN'T EXIST
- `figma.getImageAsync()` - Use alternatives
- Many other APIs that might exist in other contexts

**Alternative approach - Work with current context:**

```typescript
// ✅ Use figma.currentPage for operations on current page
const currentPageNodes = figma.currentPage.findAllWithCriteria({...});

// ✅ Use figma.root for document-level operations
const allPages = figma.root.children;
```

### Node Traversal

**Recommended pattern for traversing all pages:**

```typescript
function findAllTextNodes(): any[] {
  const allTextNodes: any[] = [];

  // Check if we can access all pages
  if (!figma.root?.children) {
    // Fallback to current page
    return findTextNodesInPage(figma.currentPage);
  }

  // Traverse all pages
  for (const page of figma.root.children) {
    allTextNodes.push(...findTextNodesInPage(page));
  }

  return allTextNodes;
}

function findTextNodesInPage(node: any): any[] {
  const textNodes: any[] = [];

  if (!node) return textNodes;

  if (node.type === 'TEXT') {
    textNodes.push(node);
  }

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      textNodes.push(...findTextNodesInPage(child));
    }
  }

  return textNodes;
}
```

## Error Handling Best Practices

### 1. Validate Figma Environment Early

```typescript
private async validateFigmaEnvironment(): Promise<void> {
  if (typeof figma === 'undefined') {
    throw new Error('Figma API not available');
  }
  if (!figma.currentPage) {
    throw new Error('Cannot access current page');
  }
  if (!figma.root) {
    throw new Error('Cannot access document root');
  }
  if (!figma.ui || typeof figma.ui.postMessage !== 'function') {
    throw new Error('UI message handler not available');
  }
}
```

### 2. Skip Invalid Nodes Gracefully

```typescript
for (const node of nodes) {
  try {
    // Skip empty text nodes silently
    if (node.characters && node.characters.length === 0) {
      continue;
    }

    // Process node...
  } catch (error) {
    // Log but continue
    console.warn(`Error processing node ${node.id}:`, error);
  }
}
```

### 3. Validate Arrays Before Array Operations

```typescript
// ❌ Don't do this
const styleFills = style.fills;
if (styleFills.find((fill) => fill.color)) {
  // Crashes if fills is undefined
  // ...
}

// ✅ Do this instead
const styleFills = style.fills as readonly Paint[] | undefined;
if (styleFills && styleFills.find((fill) => fill.color)) {
  // ...
}
```

### 4. Use Fallbacks for Multi-Page Access

```typescript
let totalTextLayers = 0;

try {
  // Try to access all pages
  if (figma.root && figma.root.children) {
    for (const page of figma.root.children) {
      totalTextLayers += findTextNodesInPage(page).length;
    }
  }
} catch (error) {
  // Fallback: just use current page
  totalTextLayers = findTextNodesInPage(figma.currentPage).length;
}
```

## Testing Checklist for New Features

Before committing code that uses Figma APIs:

- [ ] Validate figma global exists
- [ ] Check figma.currentPage availability
- [ ] Check figma.root availability
- [ ] Check figma.ui.postMessage availability
- [ ] Test with empty document (0 pages)
- [ ] Test with single page document
- [ ] Test with multi-page document
- [ ] Test with pages containing empty text nodes
- [ ] Test with pages containing deeply nested groups
- [ ] Use Date.now() instead of performance.now()
- [ ] Skip all empty text nodes without errors
- [ ] Validate array properties before calling array methods
- [ ] Handle missing/undefined properties gracefully
- [ ] Test plugin reload in Figma
- [ ] Check Figma console for any errors

## Quick Reference: Safe Figma API Patterns

### ✅ Safe: Navigation & Access

```typescript
figma.currentPage; // Currently open page
figma.root.children; // All pages in document
figma.root.name; // Document name
figma.fileKey; // Document ID
figma.ui.postMessage(msg); // Send message to UI
```

### ✅ Safe: Node Tree Traversal

```typescript
node.type; // Node type (e.g., 'TEXT')
node.children; // Child nodes (if any)
node.characters; // Text content
node.characters.length; // Character count
node.name; // Node name
node.id; // Node ID
```

### ✅ Safe: Text Node Properties (with validation)

```typescript
if (node.characters?.length > 0) {
  node.getRangeFontName(0, 1); // Get font
  node.getRangeFontSize(0, 1); // Get size
}
```

### ❌ Unsafe: Don't Use These

```typescript
figma.loadPageAsync(); // DOESN'T EXIST
performance.now(); // NOT AVAILABLE
```

## Debugging Figma Plugin Errors

### Enable Console Logging

```typescript
// Add detailed logging at each step
console.log('Starting validation...');
console.log(`Found ${pages.length} pages`);
console.log(`Processing page: ${page.name}`);
console.log(`Found ${textNodes.length} text nodes`);
```

### Check Error Stack Traces

Figma shows full stack traces in the console. Look for:

- Which function threw the error
- What API call failed
- What parameters were passed

### Use Try-Catch with Context

```typescript
try {
  // Do something with Figma API
} catch (error) {
  console.error('Context: Processing node', nodeId);
  console.error('Error:', error);
  console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
}
```

---

**Last Updated**: 2025-11-22  
**Version**: 1.0  
**Author**: Claude Code (with Ryan Uesato)

# Progress Tracking Implementation Guide

This document explains the granular progress tracking implementation in the main context (Figma plugin code).

## Overview

The plugin now features detailed progress tracking with:
- **Incremental progress bar** (0-100%)
- **State transitions** (validating → scanning → processing → complete)
- **Action step list** showing what the plugin is currently doing

## Implementation Status

### ✅ Fully Implemented

Both UI and main context now support real-time progress tracking:

#### UI Side
- `App.tsx` - Passes `progress`, `currentStep`, and `auditState` to `ProgressIndicator`
- `ProgressIndicator.tsx` - Displays progress bar and tracks all steps
- `useAuditState.ts` - Manages state transitions and progress values

#### Main Context Side
- `auditEngine.ts` - Sends progress messages during validation and scanning
- `processor.ts` - Reports detailed progress during processing phase
- All progress updates are forwarded to the UI via `STYLE_AUDIT_PROGRESS` messages

## Message Format

```typescript
// Type definition (already in src/shared/types.ts)
{
  type: 'STYLE_AUDIT_PROGRESS';
  payload: {
    state: 'scanning' | 'processing';
    progress: number; // 0-100
    currentStep: string; // Detailed message like "Scanning page 2 of 5..."
    pagesScanned?: number;
    layersProcessed?: number;
  };
}
```

## Implementation Example

Here's how the main context should send progress updates:

### Phase 1: Validating (0-10%)

```typescript
// In auditEngine.ts or validator.ts

figma.ui.postMessage({
  type: 'STYLE_AUDIT_PROGRESS',
  payload: {
    state: 'validating',
    progress: 5,
    currentStep: 'Checking document structure...'
  }
});

// Validate document size
figma.ui.postMessage({
  type: 'STYLE_AUDIT_PROGRESS',
  payload: {
    state: 'validating',
    progress: 10,
    currentStep: 'Validating page access...'
  }
});
```

### Phase 2: Scanning (10-40%)

```typescript
// In scanner.ts

const totalPages = figma.currentPage.parent.children.length;
let scannedPages = 0;

for (const page of pages) {
  scannedPages++;
  const progressPercent = 10 + (scannedPages / totalPages) * 30; // 10-40%

  figma.ui.postMessage({
    type: 'STYLE_AUDIT_PROGRESS',
    payload: {
      state: 'scanning',
      progress: Math.round(progressPercent),
      currentStep: `Scanning page ${scannedPages} of ${totalPages}...`,
      pagesScanned: scannedPages
    }
  });

  // Scan page for text layers
  const layers = findTextLayers(page);

  figma.ui.postMessage({
    type: 'STYLE_AUDIT_PROGRESS',
    payload: {
      state: 'scanning',
      progress: Math.round(progressPercent + 5),
      currentStep: `Found ${layers.length} text layers on ${page.name}...`
    }
  });
}
```

### Phase 3: Processing (40-95%)

```typescript
// In processor.ts

const totalLayers = allTextLayers.length;
let processedLayers = 0;

for (const layer of allTextLayers) {
  processedLayers++;
  const progressPercent = 40 + (processedLayers / totalLayers) * 55; // 40-95%

  // Update every 10 layers or every 5% to avoid overwhelming the UI
  if (processedLayers % 10 === 0 || processedLayers === totalLayers) {
    figma.ui.postMessage({
      type: 'STYLE_AUDIT_PROGRESS',
      payload: {
        state: 'processing',
        progress: Math.round(progressPercent),
        currentStep: `Processing layer ${processedLayers} of ${totalLayers}...`,
        layersProcessed: processedLayers
      }
    });
  }

  // Process individual layer
  const metadata = extractLayerMetadata(layer);

  // Sub-steps for detailed operations
  if (processedLayers % 50 === 0) {
    figma.ui.postMessage({
      type: 'STYLE_AUDIT_PROGRESS',
      payload: {
        state: 'processing',
        progress: Math.round(progressPercent),
        currentStep: 'Resolving library sources...'
      }
    });
  }
}

// Final processing steps
figma.ui.postMessage({
  type: 'STYLE_AUDIT_PROGRESS',
  payload: {
    state: 'processing',
    progress: 90,
    currentStep: 'Analyzing style usage patterns...'
  }
});

figma.ui.postMessage({
  type: 'STYLE_AUDIT_PROGRESS',
  payload: {
    state: 'processing',
    progress: 95,
    currentStep: 'Calculating metrics...'
  }
});
```

### Phase 4: Complete (100%)

```typescript
figma.ui.postMessage({
  type: 'STYLE_AUDIT_COMPLETE',
  payload: {
    result: auditResult,
    duration: Date.now() - startTime
  }
});
```

## Best Practices

### 1. Update Frequency
- **Small files (<100 layers)**: Update every 10-20 layers
- **Medium files (100-1000 layers)**: Update every 50 layers or 5% progress
- **Large files (>1000 layers)**: Update every 100 layers or 2% progress

### 2. Progress Distribution
- **Validating**: 0-10% (fast, mostly checks)
- **Scanning**: 10-40% (page traversal, layer discovery)
- **Processing**: 40-95% (bulk of the work - metadata extraction, style analysis)
- **Finalizing**: 95-100% (aggregation, metrics)

### 3. Descriptive Messages
Use specific, actionable messages:
- ✅ Good: "Scanning page 3 of 5..."
- ✅ Good: "Processing layer 250 of 1,247..."
- ✅ Good: "Resolving library sources for Design System..."
- ❌ Bad: "Processing..."
- ❌ Bad: "Working..."

### 4. Performance Considerations
- Batch updates to avoid blocking the main thread
- Use `requestIdleCallback` or similar for non-critical updates
- Throttle messages to ~100ms intervals maximum

## Progress Distribution (Implemented)

The audit progress is distributed across phases as follows:

- **Validating (0-10%)**: Document structure checks, page access validation, layer counting
- **Scanning (10-40%)**: Page discovery, text layer collection, hierarchy building
- **Processing (40-95%)**: Style extraction, token detection, layer processing, metrics calculation
- **Finalizing (95-100%)**: Final result assembly

## Testing

To test progress tracking:
1. Add console.log statements in main context before each postMessage
2. Use Chrome DevTools to inspect message flow
3. Test with files of varying sizes (small, medium, large)
4. Verify progress bar moves smoothly and doesn't jump
5. Check that step messages are descriptive and accurate

## Related Files

- `src/shared/types.ts` - Message type definitions
- `src/ui/App.tsx` - Calls `simulateInitialProgress()` (temporary)
- `src/ui/components/ProgressIndicator.tsx` - Displays progress and steps
- `src/ui/hooks/useAuditState.ts` - State management
- `src/ui/hooks/useMessageHandler.ts` - Message handling

---

**Note**: The simulated progress in `App.tsx` is a temporary solution and should be replaced with real progress updates from the main context as described in this document.

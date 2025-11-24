# Testing Overview: Complete Feature Guide

**Last Updated**: November 23, 2025  
**Status**: ✅ Production Ready

This document provides an overview of all testing documentation for the Figma Font Scope plugin's style replacement and token replacement features.

---

## Quick Navigation

### 🚀 Start Here

- **New to testing?** → Read `STYLE_REPLACEMENT_QUICKSTART.md` (5 minutes)
- **Want comprehensive tests?** → Read `TESTING_STYLE_REPLACEMENT.md` (30 minutes)
- **Looking for architecture?** → See "Architecture Overview" below

### 📚 Documentation Files

| Document                          | Purpose                      | Time   | Audience     |
| --------------------------------- | ---------------------------- | ------ | ------------ |
| `STYLE_REPLACEMENT_QUICKSTART.md` | Quick reference, 5-min test  | 5 min  | All users    |
| `TESTING_STYLE_REPLACEMENT.md`    | 7 detailed scenarios         | 30 min | QA engineers |
| `TESTING_OVERVIEW.md`             | This file - navigation guide | 2 min  | All users    |
| `STYLE_GOVERNANCE_SPEC.md`        | Feature specification        | 30 min | Product team |

---

## Feature Summary

### What's Implemented

**Phase 5: Text Style Replacement** ✅

- Replace all instances of one text style with another
- Bulk operation across entire Figma document
- Safety: Version history checkpoint before changes
- Intelligent batching (100→25→100 layers/batch)
- Error recovery with retry logic
- Real-time progress indication

**Phase 6: Design Token Replacement** ✅

- Replace design tokens using same architecture
- Token detection via Figma Variables API
- Cross-collection token replacement
- Same safety model as style replacement

**Phase 4: Detail Panel & Navigation** ✅

- Select any style/token to see affected layers
- Click-to-navigate to layers in Figma canvas
- Search/filter styles and tokens
- Keyboard shortcuts (Space, Enter, Arrow keys)

---

## Testing Workflow

### For First-Time Users

```
1. Build the plugin
   └─ npm run build

2. Open a Figma file with styles
   └─ Create or use existing design system file

3. Load plugin in Figma
   └─ Open plugin panel

4. Follow STYLE_REPLACEMENT_QUICKSTART.md
   └─ Complete 9-step test (5 minutes)

5. Verify success
   └─ Check File → Version History for checkpoint
   └─ Re-run audit to confirm changes
```

### For QA/Thorough Testing

```
1. Complete first-time user flow (above)

2. Follow TESTING_STYLE_REPLACEMENT.md scenarios:
   ├─ Scenario 1: Basic (10-20 layers)
   ├─ Scenario 2: Large batch (100+ layers)
   ├─ Scenario 3: Library styles
   ├─ Scenario 4: Components
   ├─ Scenario 5: Error handling
   ├─ Scenario 6: Validation
   └─ Scenario 7: Mixed adoption

3. Use success checklist
   └─ Verify all pass before deploying
```

---

## Feature Architecture

### User Workflow

```
┌─────────────────────────────────────┐
│  Run Audit                          │ Analyze entire document
│  [Click "Run Audit" button]         │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  View Styles or Tokens              │ Browse by library/collection
│  [Click "Styles" or "Tokens" tab]   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Select Style/Token                 │ See all affected layers
│  [Click in tree]                    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Detail Panel Shows Layers          │ Grouped by page/component
│  [Right sidebar]                    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Click "Replace Style/Token"        │ Open picker modal
│  [Button in detail panel]           │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Select Target (StylePicker)        │ Search, filter by library
│  [Click target style/token]         │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Confirm Replacement                │ Shows impact clearly
│  [Dialog: "Replace X with Y?"]      │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Progress Indication                │ Real-time batch updates
│  [Progress bar fills 0-100%]        │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Success Message                    │ Shows layers updated
│  [Option to re-run audit]           │
└─────────────────────────────────────┘
```

### Technical Flow

```
UI: Click "Replace Style" button
  │
  ├─→ DetailPanel triggers onReplaceStyle()
  │
  └─→ App.tsx: handleReplaceStyle()
      │
      ├─→ Open StylePicker modal
      │
      └─→ User selects target style
          │
          ├─→ Open ConfirmationDialog
          │
          └─→ User confirms
              │
              └─→ Send REPLACE_STYLE message to main context
                  │
                  ├─→ code.ts: handleReplaceStyle()
                  │
                  └─→ ReplacementEngine.replaceStyle()
                      │
                      ├─→ validating: Check source ≠ target
                      │
                      ├─→ creating_checkpoint: figma.saveVersionHistoryAsync()
                      │
                      ├─→ processing: BatchProcessor.processBatches()
                      │   ├─ Batch 1: Update 100 layers
                      │   ├─ Check for errors
                      │   ├─ Adjust batch size if needed
                      │   └─ Continue until done
                      │
                      ├─→ complete: All layers updated
                      │
                      └─→ Send REPLACEMENT_COMPLETE message to UI
                          │
                          └─→ Show success message
                              └─→ Prompt "Re-run Audit"
```

---

## What Gets Tested

### Core Features

- ✅ Style detection and listing
- ✅ Token detection and listing
- ✅ Detail panel with layer listing
- ✅ StylePicker modal with search/filter
- ✅ TokenPicker modal with search/filter
- ✅ Confirmation dialog
- ✅ Replacement execution
- ✅ Progress indication
- ✅ Version checkpoint creation

### Safety Features

- ✅ Validation prevents invalid operations
- ✅ Version checkpoint before changes
- ✅ Rollback capability via Figma version history
- ✅ Error recovery with retry
- ✅ Partial failure handling
- ✅ Error classification and logging

### Performance

- ✅ Batch processing efficiency
- ✅ Adaptive batch sizing
- ✅ Real-time progress updates
- ✅ Memory usage within limits
- ✅ Scales to 500+ layers

---

## File Locations

### Testing Documentation

```
/Users/ryanuesato/Documents/src/figma-fontscope/
├─ STYLE_REPLACEMENT_QUICKSTART.md      [Quick 5-min test]
├─ TESTING_STYLE_REPLACEMENT.md         [Detailed 7 scenarios]
├─ TESTING_OVERVIEW.md                  [This file]
└─ STYLE_GOVERNANCE_SPEC.md             [Full specification]
```

### Source Code

```
src/main/replacement/
├─ replacementEngine.ts      [Core state machine + replaceStyle/replaceToken]
├─ batchProcessor.ts         [Adaptive batch processing]
├─ errorRecovery.ts          [Error classification + retry]
└─ checkpoint.ts             [Version history integration]

src/ui/components/
├─ StylePicker.tsx           [Modal for selecting target style]
├─ TokenPicker.tsx           [Modal for selecting target token]
├─ DetailPanel.tsx           [Shows layers using selected style/token]
└─ ConfirmationDialog.tsx    [Confirms replacement operation]

src/main/code.ts             [Message handler for REPLACE_STYLE/REPLACE_TOKEN]
src/ui/App.tsx               [Orchestrates replacement workflow UI]
```

---

## Key Testing Scenarios

### Scenario 1: Basic Replacement (Start Here)

- ✅ 5-10 text layers using one style
- ✅ Replace with different style
- ✅ Verify all updated
- ✅ Check version checkpoint

**Expected Time**: 2-3 minutes

### Scenario 2: Large Batch

- ✅ 100+ text layers
- ✅ Verify batch processing (shows batch count)
- ✅ Performance baseline check
- ✅ Multiple batches processing

**Expected Time**: 3-5 minutes

### Scenario 3: Library Styles

- ✅ Styles from team libraries
- ✅ Cross-library replacement
- ✅ Library names shown correctly
- ✅ Both source and target show library

**Expected Time**: 2-3 minutes

### Scenario 4: Components

- ✅ Styles in main components
- ✅ Component instances update
- ✅ Nested components work
- ✅ Overrides preserved

**Expected Time**: 3-4 minutes

### Scenario 5: Error Handling

- ✅ Network interruption
- ✅ Graceful error display
- ✅ Version checkpoint protection
- ✅ Retry capability

**Expected Time**: 2-3 minutes

**Total Testing Time**: 12-18 minutes for all scenarios

---

## Success Criteria

✅ **All tests pass** before deployment

- [ ] Build completes without errors: `npm run build`
- [ ] Plugin loads in Figma without console errors
- [ ] Audit discovers styles and tokens correctly
- [ ] DetailPanel shows affected layers
- [ ] StylePicker/TokenPicker work with search/filter
- [ ] Replacement executes successfully
- [ ] Progress indicator shows real-time updates
- [ ] Version checkpoint created in File → Version History
- [ ] Re-audit shows updated usage counts
- [ ] No TypeScript errors in console
- [ ] All test scenarios pass
- [ ] Performance within baseline (see docs)

---

## Troubleshooting Quick Reference

| Problem                    | Solution                     | Details                                    |
| -------------------------- | ---------------------------- | ------------------------------------------ |
| Replace button not showing | Click style in tree first    | Must select style before button appears    |
| Replacement seems stuck    | Wait 30 seconds              | Large batches take time                    |
| Version checkpoint missing | Check File → Version History | May have different name                    |
| Layers not updated         | Re-run audit                 | Cached data - audit refreshes view         |
| Console errors             | Check browser F12            | Log messages prefixed with `[Replacement]` |
| Components not updating    | Verify not detached          | Figma limitation on detached instances     |

**See TESTING_STYLE_REPLACEMENT.md for detailed troubleshooting.**

---

## Browser Console Debugging

When testing, open **F12 Browser Console** to see:

```javascript
// Replacement start
[Replacement] Starting style replacement: {
  sourceStyleId: "S:abc123...",
  targetStyleId: "S:def456...",
  affectedLayerCount: 10
}

// Progress updates
[Replacement] Processing batch 1 of 2

// Completion
[Replacement] Style replacement complete: {
  updated: 10,
  failed: 0,
  checkpoint: "Style Replacement - 2025-11-23 15:30:45"
}
```

**Expected**: No errors for successful replacements

---

## Performance Benchmarks

For reference on standard hardware:

| Scenario     | Expected Time | Notes             |
| ------------ | ------------- | ----------------- |
| 10 layers    | 1-2s          | Single batch      |
| 50 layers    | 2-5s          | Single batch      |
| 100 layers   | 5-10s         | 1-2 batches       |
| 500 layers   | 20-30s        | 5+ batches        |
| 1000+ layers | 30-60s        | Adaptive batching |

**If significantly slower**: Check network latency (DevTools Network tab)

---

## Next Steps

### Ready to Test?

1. Build: `npm run build`
2. Open Figma file
3. Load plugin
4. Follow **STYLE_REPLACEMENT_QUICKSTART.md**

### Want Comprehensive QA?

1. Complete quick start
2. Follow **TESTING_STYLE_REPLACEMENT.md** for 7 scenarios
3. Use success checklist
4. Report any issues

### Finding Issues?

1. Check browser console (F12)
2. Review troubleshooting section above
3. See TESTING_STYLE_REPLACEMENT.md debugging guide
4. Verify document structure (components, libraries, pages)

---

## Related Documentation

- **Specification**: `specs/002-style-governance/spec.md`
- **Feature Plan**: `specs/002-style-governance/plan.md`
- **Data Model**: `specs/002-style-governance/data-model.md`
- **Task Checklist**: `specs/002-style-governance/tasks.md`

---

## Questions?

| **How do I...**             | **Read This**                                               |
| --------------------------- | ----------------------------------------------------------- |
| ...start testing?           | STYLE_REPLACEMENT_QUICKSTART.md                             |
| ...test thoroughly?         | TESTING_STYLE_REPLACEMENT.md                                |
| ...debug issues?            | TESTING_STYLE_REPLACEMENT.md → Debugging                    |
| ...understand architecture? | STYLE_GOVERNANCE_SPEC.md                                    |
| ...troubleshoot?            | TESTING_OVERVIEW.md (above) or TESTING_STYLE_REPLACEMENT.md |

---

**Status**: ✅ Ready for testing and deployment

**Questions or issues?** Check the troubleshooting sections above or review browser console for detailed error messages.

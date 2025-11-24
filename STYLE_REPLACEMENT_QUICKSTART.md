# Style Replacement Feature - Quick Start Guide

**Status**: ✅ Production Ready (Phase 5 & 6 Complete)

A quick reference for testing the text style replacement feature in Figma.

---

## 30-Second Overview

The plugin now replaces text styles across your entire document in 3 clicks:

1. **Run Audit** → See all styles in document
2. **Click "Replace Style"** → Pick old style & new style
3. **Confirm** → All instances replaced safely with version checkpoint

---

## Quick Test (5 minutes)

### Prerequisites

- [ ] Built project: `npm run build`
- [ ] Figma file open with 5+ text layers using same style
- [ ] Plugin loaded in Figma

### Testing Steps

1. **Open Plugin** in Figma

2. **Click "Run Audit"**
   - Wait ~10 seconds for scan to complete
   - See "Summary" tab with style count

3. **Click "Styles" tab**
   - Find a style with 5+ usages (e.g., "Heading 1")
   - Click it to expand

4. **Click style in tree**
   - Right panel shows all text layers using this style
   - See their pages and content preview

5. **Click "Replace Style (X layers)"**
   - StylePicker modal opens
   - All styles shown grouped by library
   - Search box to find replacement style

6. **Select target style** (e.g., "Heading 2")
   - Click it to highlight in blue
   - Click "Select Style" button

7. **Confirm replacement**
   - Dialog shows: "Replace [Heading 1] with [Heading 2] in X layers?"
   - Click "Replace" button

8. **Watch progress**
   - Progress bar fills from 0-100%
   - Shows current batch (e.g., "Batch 1 of 2")
   - Done in <10 seconds for typical sizes

9. **Verify success**
   - Success message appears
   - Option to "Re-run Audit" to confirm changes
   - Check File → Version History for "Style Replacement - [timestamp]"

### Expected Result

✅ All text layers changed from old style to new style  
✅ Component instances updated  
✅ Version checkpoint created for safety  
✅ No errors in browser console

---

## Key Features Demonstrated

| Feature                | How to Test                                        |
| ---------------------- | -------------------------------------------------- |
| **Batch Processing**   | Replace 100+ layers, watch "Batch 1 of 2" progress |
| **Library Support**    | Styles show by library (Local, Team Library, etc.) |
| **Component Handling** | Components instances auto-update                   |
| **Safety Checkpoint**  | Check File → Version History                       |
| **Error Recovery**     | Offline mode in DevTools simulates network issue   |
| **Visual Feedback**    | Real-time progress bar & batch indicator           |

---

## What You'll See

### Plugin UI - Before Replacement

```
Summary    Styles    Tokens    Analytics
           [Heading 1] (10 usages)
            └─ Page 1
            └─ Page 2
            └─ Main Component: Button
```

### Plugin UI - During Replacement

```
⏳ Creating checkpoint...

▮▮▮▮▮░░░░░ 45%
Processing batch 1 of 2 (100 layers)
```

### Plugin UI - After Replacement

```
✅ Replacement complete!
   10 layers updated in 3.2 seconds
   [Re-run Audit] [Done]
```

### Figma File - Version History

```
File → Version History
├─ Current
├─ Style Replacement - 2025-11-23 15:30:45  ← Click here to rollback
├─ Style Audit - 2025-11-23 15:22:10
└─ ...
```

---

## Where to Find Things

| Item                   | Location                                  |
| ---------------------- | ----------------------------------------- |
| **Run Audit button**   | Main plugin panel (initial state)         |
| **Styles tab**         | Plugin results panel (after audit)        |
| **DetailPanel**        | Right side, when style selected           |
| **Replace button**     | Bottom of DetailPanel                     |
| **StylePicker**        | Modal dialog after clicking Replace       |
| **ConfirmationDialog** | Modal dialog after selecting target style |
| **ProgressIndicator**  | Overlay during replacement                |
| **Version checkpoint** | File → Version History in Figma           |

---

## Troubleshooting

### "Replace Style button not showing"

- [ ] Click a style in tree first
- [ ] Verify style has usages (not 0)
- [ ] Check browser console (F12) for errors

### "Replacement takes too long"

- [ ] Normal for 500+ layers
- [ ] Check Network tab (DevTools) for issues
- [ ] Try with fewer layers first

### "Changes not showing after replacement"

- [ ] Click "Re-run Audit" button
- [ ] Wait for new audit to complete
- [ ] Check browser console for errors

### "Version checkpoint not created"

- [ ] Check File → Version History in Figma
- [ ] Verify edit permissions on document
- [ ] Check browser console for errors

---

## Architecture Inside

**How replacement works** (technical):

1. **validating**: Check source ≠ target, both exist, layers selected
2. **creating_checkpoint**: `figma.saveVersionHistoryAsync()` creates restore point
3. **processing**: Batch processor updates layers (100/batch)
   - Adaptive sizing: If error → reduce to 25 layers
   - Retry logic: Network errors retry 3x with backoff
   - Progress callback: Updates UI in real-time
4. **complete**: Sends results to UI, engine disposed

**Safety model:**

- ✅ Version history checkpoint BEFORE any changes
- ✅ Adaptive batch sizing prevents timeouts
- ✅ Error recovery with exponential backoff
- ✅ Component override preservation
- ✅ Rollback available via version history

---

## Manual Testing Checklist

**Before First Use:**

- [ ] Build complete: `npm run build`
- [ ] No TypeScript errors in output
- [ ] Plugin loads in Figma without errors

**Basic Test (Scenario 1):**

- [ ] Audit runs successfully
- [ ] Styles appear in tree
- [ ] DetailPanel shows layers for selected style
- [ ] StylePicker opens with all styles
- [ ] Replacement completes without errors
- [ ] Re-audit shows updated usage counts
- [ ] Version checkpoint appears in File → Version History

**Advanced Test (Scenario 2 - 100+ layers):**

- [ ] Batch processing shows multiple batches
- [ ] Progress bar updates smoothly
- [ ] All layers updated correctly
- [ ] Duration reasonable (<30s for 100 layers)

**Library Test (Scenario 3):**

- [ ] Styles grouped by library in tree
- [ ] Cross-library replacement works
- [ ] StylePicker shows both local and library styles
- [ ] ConfirmationDialog shows library names

**Component Test (Scenario 4):**

- [ ] Component instances updated
- [ ] Nested components work correctly
- [ ] Component overrides preserved

**Error Test (Scenario 5):**

- [ ] Offline mode simulation handled gracefully
- [ ] Error message helpful and clear
- [ ] Version checkpoint prevents data loss

---

## What's Next?

### Phase 6 - Token Replacement (Already Complete! 🎉)

Token replacement works the same way:

1. Run audit (includes tokens)
2. Click Tokens tab
3. Select token → Click "Replace Token"
4. Pick new token → Confirm
5. Token bindings updated with same safety model

### Phase 7 - Export (Coming Next)

- PDF report generation with metrics
- CSV data export for analysis

---

## Performance Expectations

On standard hardware:

| Document Size  | Time   | Expected          |
| -------------- | ------ | ----------------- |
| 1-50 layers    | <5s    | Single batch      |
| 50-100 layers  | 5-10s  | 1-2 batches       |
| 100-500 layers | 10-30s | Multiple batches  |
| 500+ layers    | 30-60s | Adaptive batching |

Slower? Check:

- Network latency (DevTools Network tab)
- Document size (Figma file size)
- Style complexity (many properties)

---

## Getting Help

**Check Browser Console** (F12):

- Look for `[Replacement]` prefixed logs
- Shows operation progression
- Error messages have actionable info

**Verify Document State:**

- File → Version History has checkpoint
- Styles have correct usage counts after re-audit
- No broken component references

**Report Issues With:**

- Document structure (pages, layers, components)
- Style configuration (local vs library)
- Browser console errors
- Expected vs actual behavior

---

## Success! 🎉

If you've completed all steps above without errors:

✅ **Feature is working correctly**  
✅ **Ready for production use**  
✅ **Can handle real design system migrations**

**Next step**: Try it on your actual design system document!

---

See `TESTING_STYLE_REPLACEMENT.md` for detailed test scenarios.

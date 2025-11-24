# Testing Instructions: Text Style Replacement Feature

**Feature Status**: ✅ Fully Implemented (Phase 5 Complete)

This document provides step-by-step instructions for testing the bulk style replacement feature.

---

## Overview

The style replacement feature allows you to replace all instances of one text style with another across your entire Figma document. The feature includes:

- **Safety Features**: Version history checkpoint created before changes
- **Batch Processing**: Adaptive batching (100→25→100 layers per batch)
- **Error Recovery**: Automatic retry with exponential backoff for transient errors
- **Progress Tracking**: Real-time progress indication during replacement
- **Rollback Support**: Version history allows rollback if needed

---

## Prerequisites

1. **Build the plugin**:

   ```bash
   cd /Users/ryanuesato/Documents/src/figma-fontscope
   npm run build
   ```

2. **Open a Figma file** with text layers and styles (local or library styles)

3. **Load the plugin** in your Figma file using the development build

---

## Test Scenario 1: Basic Style Replacement (Recommended First Test)

### Setup

1. Create a simple Figma file with:
   - At least 5-10 text layers using "Heading 1" style (from a local or library style)
   - At least one alternative style available (e.g., "Heading 2")
   - Text layers should be on 1-2 different pages

### Testing Steps

**Step 1: Run Audit**

- Open the plugin
- Click "Run Audit" button
- Wait for audit to complete (~10-30 seconds depending on document size)
- Verify "Summary" tab shows total styles found

**Step 2: Navigate to Styles**

- Click "Styles" tab in the results view
- Expand the style tree to find "Heading 1" style
- You should see it grouped by library (Local or library name)
- Verify usage count shows ~5-10 layers

**Step 3: Select Style for Replacement**

- Click on "Heading 1" style in the tree
- Verify the **DetailPanel** appears on the right showing:
  - All text layers using this style
  - Grouped by page
  - Each layer shows its text content preview
  - Status badges (Fully Styled, Partial, etc.)

**Step 4: Open Style Picker**

- In the DetailPanel, click the **"Replace Style (X layers)"** button
- A **StylePicker modal** should appear showing:
  - All available styles in your document
  - Styles grouped by library
  - Search box to filter styles
  - Library dropdown filter

**Step 5: Select Target Style**

- Search for or scroll to "Heading 2" style
- Click to select it (it will highlight in blue)
- Click **"Select Style"** button

**Step 6: Confirm Replacement**

- A **ConfirmationDialog** should appear with:
  - Title: "Confirm Style Replacement"
  - Message showing source style, target style, and layer count
  - Warning: "This will create a version checkpoint for safety."
- Click **"Replace"** button to proceed

**Step 7: Watch Progress**

- A **ProgressIndicator** should show:
  - Current state: "Creating checkpoint..." (briefly)
  - Then: "Replacing batch 1 of X..."
  - Progress bar filling from 0-100%
  - Real-time updates as batches complete

**Step 8: Verify Completion**

- Once complete, you should see success message:
  - "X layers updated"
  - Duration of replacement
  - Option to re-run audit
- Click "Re-run Audit" to verify changes

**Step 9: Verify Changes**

- Audit should now show "Heading 1" with 0 usages
- "Heading 2" should now show increased usage count (original + replaced)
- All text layers that were using "Heading 1" should now show "Heading 2"

### Expected Behavior

✅ All text layers using source style are replaced with target style  
✅ Component overrides are preserved  
✅ Version history checkpoint visible in File → Version History  
✅ No errors in browser console (check with F12)

---

## Test Scenario 2: Replacement with Large Layer Count (100+ Layers)

### Setup

1. Use a Figma file with 50-100+ text layers using the same style
2. This tests the adaptive batching system

### Testing Steps

1. Follow the same steps as Scenario 1
2. During **Step 7 (Progress)**, observe:
   - First batch shows "Batch 1 of 2" (100 layers)
   - After successful first batch, moves to batch 2
   - Progress indicator shows real-time percentage (10-100%)
   - Batch size indicator shows "100 layers/batch"

3. After completion:
   - View **File → Version History** in Figma
   - Should see checkpoint named "Style Replacement - [timestamp]"
   - Confirms checkpoint was created before any changes

### Expected Behavior

✅ Batching works correctly (100 layers per batch)  
✅ Multiple batches process sequentially  
✅ Progress indicator updates smoothly  
✅ Version checkpoint created with timestamp

---

## Test Scenario 3: Replacement with Library Styles

### Setup

1. Figma file with text styles from **team library** (not just local styles)
2. Styles should be from different libraries (e.g., "Library A" has "Body", "Library B" has "Caption")

### Testing Steps

1. Run audit and verify styles are grouped by library:
   - Local styles in "Local" group
   - Team library styles under library name group
2. Select a style from one library (e.g., "Body" from "Library A")

3. In StylePicker, verify:
   - Styles are grouped by library
   - Both "Local" and library groups are shown
   - Library dropdown filter works

4. Select a style from a different library (e.g., "Caption" from "Library B")

5. In ConfirmationDialog, verify message shows:
   - Source: "Body" from "Library A"
   - Target: "Caption" from "Library B"
   - Example: "Replace [Body] from [Library A] with [Caption] from [Library B] in [5] layers?"

6. Complete replacement and verify:
   - All source style usages show 0
   - All target style usages increased
   - Library assignments preserved correctly

### Expected Behavior

✅ Cross-library replacement works correctly  
✅ Library names shown clearly in UI  
✅ Target style library correctly assigned to replaced layers

---

## Test Scenario 4: Component Instance Handling

### Setup

1. Figma file with:
   - Text styles applied to text in main components
   - Instances of those components elsewhere in document
   - Some instances with style overrides

### Testing Steps

1. Audit the document

2. Find a style used in component main components (look for component icon in DetailPanel)

3. Replace the style following normal steps

4. After replacement, verify:
   - All component instances updated
   - Component instance overrides preserved
   - No broken component references
   - Nested components still work correctly

5. Open a component instance in the design and verify:
   - Text is using new style
   - Override status maintained
   - Visual appearance correct

### Expected Behavior

✅ Component instances updated correctly  
✅ Component override states preserved  
✅ No broken component references  
✅ Nested components work properly

---

## Test Scenario 5: Error Handling (Network Interruption Simulation)

### Setup

1. File with 50+ text layers using one style
2. Browser DevTools open (F12)

### Testing Steps

1. Start style replacement

2. When you see "Replacing batch 1 of 2..." in progress indicator:
   - Open DevTools (F12)
   - Go to Network tab
   - Toggle "Offline" mode to simulate network interruption

3. Observe behavior:
   - Replacement should pause or show error
   - Check console for error messages
   - UI should remain responsive

4. Toggle "Offline" back off

5. Observe recovery:
   - Either: Retry mechanism activates
   - Or: Error message shown with retry option
   - Version checkpoint prevents data loss

### Expected Behavior

✅ Handles network errors gracefully  
✅ Error message is clear and actionable  
✅ Retry option available if applicable  
✅ Version checkpoint protects document

---

## Test Scenario 6: Validation & Error Cases

### Test 6A: Same Source and Target

1. Select a style (e.g., "Heading 1")
2. Open StylePicker
3. Try to select the same style as target
4. Verify error message: **"Source and target styles cannot be the same"**
5. Button should be disabled

### Test 6B: No Layers Affected

1. Select a style with 0 usages
2. Verify DetailPanel shows "No layers found"
3. "Replace Style" button should be disabled or show "0 layers"

### Test 6C: Replacement Interrupted (Hard Stop)

1. Start replacement with 100+ layers
2. During processing, close the Figma tab/window
3. Recover by:
   - Opening the file again
   - Going to **File → Version History**
   - Verify "Style Replacement - [timestamp]" checkpoint exists
   - Can restore to this point if partial replacement occurred

### Expected Behavior

✅ Validation prevents invalid operations  
✅ Clear error messages guide user  
✅ Version checkpoints protect against data loss  
✅ UI remains responsive during errors

---

## Test Scenario 7: Mixed Style Adoption (Fully vs Partially Styled)

### Setup

1. File with text layers that have:
   - **Fully-styled**: All properties match assigned style
   - **Partially-styled**: Some properties overridden locally
   - **Unstyled**: No style assigned

### Testing Steps

1. Run audit

2. In DetailPanel for any style, verify:
   - Fully-styled layers have green "Fully Styled" badge
   - Partially-styled layers have yellow "Partial" badge
   - Each badge color-coded

3. Replace style

4. After replacement, verify:
   - Fully-styled status preserved
   - Partial overrides still work (not removed)
   - Visual appearance maintained

### Expected Behavior

✅ All layer types updated correctly  
✅ Status badges remain accurate after replacement  
✅ Style overrides preserved where applicable

---

## Debugging: How to Check for Issues

### Browser Console (F12)

Look for messages like:

```
[Replacement] Starting style replacement: {
  sourceStyleId: "S:abc123...",
  targetStyleId: "S:def456...",
  affectedLayerCount: 10
}

[Replacement] Style replacement complete: {
  updated: 10,
  failed: 0,
  checkpoint: "Style Replacement - 2025-11-23 15:30:45"
}
```

### Version History Verification

1. Click **File → Version History** in Figma
2. You should see checkpoint: `"Style Replacement - [timestamp]"`
3. Can restore to this point anytime

### DetailPanel Verification

- Select any style
- DetailPanel should show:
  - All affected layers
  - Grouped by page and component
  - Text content preview
  - Status badges
  - "Replace Style (X layers)" button

### UI State Verification

- During replacement:
  - ProgressIndicator visible
  - Progress bar fills 10-100%
  - Current batch shown (e.g., "Batch 1 of 2")
  - Percentage updated in real-time

---

## Common Issues & Solutions

### Issue: "Replace Style" button not appearing

**Solution**:

- Verify DetailPanel is open (click style in tree)
- Verify style has affected layers (not 0 usages)
- Check browser console for errors

### Issue: Replacement seems stuck

**Solution**:

- Check Network tab in DevTools - may be network issue
- Wait for at least 30 seconds (large batches take time)
- Check console for error messages
- Manual refresh if needed

### Issue: Version checkpoint not created

**Solution**:

- Check browser console for errors
- Verify you have edit permissions on document
- Check **File → Version History** - may be there with different name
- Try replacement again

### Issue: Layers not updated after replacement

**Solution**:

- Click "Re-run Audit" to refresh
- Check browser console for errors
- Verify both styles exist in document
- Try again with smaller test case (5 layers)

### Issue: Component instances not updating

**Solution**:

- Verify main component was included in audit
- Check that instance is not detached
- Try replacement on just the main component first
- If nested: verify all levels update

---

## Success Checklist

- [ ] Basic replacement (5-10 layers) completes successfully
- [ ] Progress indicator shows real-time updates
- [ ] Version checkpoint appears in File → Version History
- [ ] All affected layers show new style in DetailPanel (re-run audit)
- [ ] Component instances updated correctly
- [ ] Library styles work (cross-library replacement)
- [ ] Validation prevents invalid operations
- [ ] Error handling works gracefully
- [ ] Browser console shows no TypeScript errors
- [ ] UI remains responsive during replacement

---

## Performance Baseline

For reference, expected performance on standard hardware:

| Layer Count | Batch Size | Duration | Expected Result    |
| ----------- | ---------- | -------- | ------------------ |
| 1-50        | 100        | <5s      | All in batch 1     |
| 51-100      | 100/25     | 5-10s    | 2 batches if error |
| 101-500     | 100        | 10-30s   | 5 batches          |
| 501+        | 100        | 30-60s   | Adaptive sizing    |

If performance is significantly slower, check for:

- Network latency (DevTools Network tab)
- Large component hierarchies (nested deeply)
- Heavy text processing (many pages)

---

## Next Steps

1. **Test basic scenario** (Scenario 1) first
2. **Test with your document** to ensure works with your styles
3. **Report any issues** with:
   - Document structure
   - Style configuration
   - Browser console errors
   - Expected vs actual behavior

4. **Ready for Phase 6?** Token replacement follows same pattern and can be tested similarly

---

**Questions?** Check the browser console (F12) for detailed logging of all replacement operations.

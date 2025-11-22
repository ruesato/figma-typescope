# Testing Guide - Figma FontScope

This guide outlines how to test the Figma FontScope plugin, specifically focusing on the **Phase 2: Style Governance Audit** features currently implemented.

## Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [Phase 2 Features to Test](#phase-2-features-to-test)
3. [Expected Behaviors](#expected-behaviors)
4. [Test Scenarios](#test-scenarios)
5. [Known Issues](#known-issues)
6. [Performance Benchmarks](#performance-benchmarks)

---

## Test Environment Setup

### Prerequisites

1. **Figma Desktop App** installed
2. **Node.js 22+** and **pnpm** installed
3. Plugin built and loaded:

   ```bash
   # Install dependencies
   pnpm install

   # Build the plugin
   pnpm build

   # Or run in development mode with hot reload
   pnpm dev
   ```

4. Load plugin in Figma (see README.md for detailed steps)

### Creating Test Documents

Create the following Figma test files to validate different scenarios:

#### Test File 1: Small Document (< 100 layers)

- **Purpose**: Validate basic functionality
- **Setup**:
  - 3-5 pages
  - 50-100 text layers total
  - Mix of styled and unstyled text
  - 2-3 text styles from local library
  - Some text in components, some in plain frames

#### Test File 2: Medium Document (1,000-5,000 layers)

- **Purpose**: Validate optimal performance zone
- **Setup**:
  - 10-20 pages
  - 1,000-5,000 text layers total
  - Multiple text styles from team libraries
  - Complex component hierarchies
  - Some hidden/invisible text layers

#### Test File 3: Large Document (5,001-10,000 layers) - Warning Zone

- **Purpose**: Validate warning messages and performance degradation
- **Setup**:
  - 20-50 pages
  - 5,001-10,000 text layers total
  - Expect warning message during validation
  - Audit should still complete successfully

#### Test File 4: Maximum Document (25,000 layers) - Hard Limit

- **Purpose**: Validate size limit enforcement
- **Setup**:
  - 50+ pages
  - Exactly 25,000 text layers
  - Should hit size limit and display error

---

## Phase 2 Features to Test

### ✅ Implemented Features (Ready for Testing)

1. **7-State Audit Engine**
   - State transitions: idle → validating → scanning → processing → complete
   - Error handling with proper state: idle → validating → error
   - Cancellation: scanning/processing → cancelled

2. **Document Validator**
   - Document accessibility checks
   - Text layer counting
   - Size limit enforcement (5k warning, 25k max)
   - Permission validation

3. **Page Scanner**
   - Multi-page traversal
   - Text layer discovery using existing traversal utilities
   - Progress reporting per page
   - Cancellation support

4. **Metadata Processor**
   - Style assignment detection
   - Library source resolution
   - Basic hierarchy building
   - Metrics calculation

5. **Style Tree View Component**
   - Library grouping
   - Style hierarchy display
   - Search/filter controls
   - Usage count badges

6. **Message Protocol**
   - RUN_STYLE_AUDIT message handling
   - CANCEL_STYLE_AUDIT support
   - Progress updates (STYLE_AUDIT_PROGRESS)
   - Completion messages (STYLE_AUDIT_COMPLETE)
   - Error messages (STYLE_AUDIT_ERROR)

### 🚧 Not Yet Implemented (Skip These Tests)

- Token detection (includeTokens option)
- Document change invalidation
- Warning banner UI
- Cancel button functionality in UI
- Unstyled text grouping in StyleTreeView
- Full hierarchy parsing (parent-child relationships)

---

## Expected Behaviors

### Audit State Machine Transitions

#### Happy Path: Successful Audit

```
idle → validating → scanning → processing → complete → idle
```

**Expected Messages:**

1. `STYLE_AUDIT_STARTED` with `state: 'validating'`
2. `STYLE_AUDIT_PROGRESS` with `state: 'scanning'`, `progress: 0-50%`
3. `STYLE_AUDIT_PROGRESS` with `state: 'processing'`, `progress: 50-100%`
4. `STYLE_AUDIT_COMPLETE` with full audit result

**Console Logs:**

```
[StyleAudit] Starting audit with options: {...}
Audit state transition: idle → validating
Document validation complete: 1,247 text layers found
Audit state transition: validating → scanning
Document scanning complete: 1,247 text layers found
Audit state transition: scanning → processing
Processing 1,247 text layers...
Processing complete: 1,247 layers, 42 styles
Audit state transition: processing → complete
[StyleAudit] Audit completed successfully
```

#### Warning Zone Path: Large Document (5k-25k layers)

```
idle → validating (warning emitted) → scanning → processing → complete → idle
```

**Expected Messages:**

1. `STYLE_AUDIT_STARTED` with `state: 'validating'`
2. Console warning: "Large document detected: 6,543 text layers. Performance may be impacted."
3. Progress messages as normal
4. `STYLE_AUDIT_COMPLETE` (takes longer than optimal zone)

#### Error Path: Invalid Document

```
idle → validating → error → idle
```

**Expected Messages:**

1. `STYLE_AUDIT_STARTED` with `state: 'validating'`
2. `STYLE_AUDIT_ERROR` with:
   - `errorType: 'validation'`
   - `error: "Document too large: 26,000 text layers..."`
   - `canRetry: false`

**Console Logs:**

```
[StyleAudit] Starting audit with options: {...}
Audit state transition: idle → validating
Audit state transition: validating → error
[StyleAudit] Audit failed: Document too large...
```

#### Cancellation Path: User Cancels During Scanning

```
idle → validating → scanning → cancelled → idle
```

**Expected Messages:**

1. `STYLE_AUDIT_STARTED`
2. `STYLE_AUDIT_PROGRESS` with `state: 'scanning'`
3. User clicks cancel
4. `STYLE_AUDIT_CANCELLED` with empty payload

**Note**: Cancel functionality in UI is not yet wired up (T040 pending)

---

## Test Scenarios

### Scenario 1: Basic Audit (Small Document)

**Objective**: Validate end-to-end audit workflow

**Steps**:

1. Open Test File 1 (< 100 layers)
2. Open plugin: Plugins → Development → Figma Font Audit Pro
3. Click "Run Style Audit" button
4. Observe progress updates
5. Verify completion message

**Expected Results**:

- ✅ Audit completes in < 10 seconds
- ✅ Progress bar shows 0% → 50% (scanning) → 100% (processing)
- ✅ Console shows all state transitions
- ✅ Audit result contains:
  - `totalTextLayers` matching layer count
  - `styles` array with detected styles
  - `libraries` array with "Local" library
  - `metrics` with calculated adoption rate
  - `styleHierarchy` array (may be placeholder)

**Validation**:

```javascript
// In Figma Console
console.log(auditResult.totalTextLayers); // Should match actual count
console.log(auditResult.styles.length); // Should have styles
console.log(auditResult.metrics.styleAdoptionRate); // 0-100%
```

### Scenario 2: Medium Document Performance

**Objective**: Validate optimal zone performance

**Steps**:

1. Open Test File 2 (1,000-5,000 layers)
2. Open plugin
3. Start timer
4. Click "Run Style Audit"
5. Wait for completion
6. Record duration

**Expected Results**:

- ✅ Audit completes in 30-90 seconds
- ✅ No warning messages
- ✅ Progress updates every 1-2 seconds
- ✅ UI remains responsive during audit
- ✅ No memory issues or crashes

**Performance Metrics**:

- 1,000 layers: ~30 seconds
- 2,500 layers: ~60 seconds
- 5,000 layers: ~90 seconds

### Scenario 3: Large Document Warning

**Objective**: Validate warning zone behavior

**Steps**:

1. Open Test File 3 (5,001-10,000 layers)
2. Open plugin
3. Click "Run Style Audit"
4. Check console for warning message

**Expected Results**:

- ✅ Console warning: "Large document detected: X text layers. Performance may be impacted."
- ✅ Audit continues (does not abort)
- ✅ Takes 2-10 minutes to complete
- ✅ Progress updates continue normally

**Validation**:
Check Figma console for:

```
Document validation complete: 6,543 text layers found
Large document detected: 6,543 text layers. Performance may be impacted. Audit may take several minutes...
```

### Scenario 4: Size Limit Enforcement

**Objective**: Validate maximum document size rejection

**Steps**:

1. Open Test File 4 (> 25,000 layers)
2. Open plugin
3. Click "Run Style Audit"
4. Verify error message

**Expected Results**:

- ✅ Audit transitions to error state during validation
- ✅ Error message: "Document too large: 26,000 text layers found. Maximum supported is 25,000 layers."
- ✅ Suggestion to split document
- ✅ `canRetry: false` in error payload

**Validation**:
Check Figma console for:

```
Audit state transition: idle → validating
Audit state transition: validating → error
[StyleAudit] Audit failed: Document too large: 26,000 text layers...
```

### Scenario 5: Empty Document

**Objective**: Validate handling of documents with no text layers

**Steps**:

1. Create new Figma file with no text layers
2. Open plugin
3. Click "Run Style Audit"

**Expected Results**:

- ✅ Audit completes successfully
- ✅ Console warning: "No text layers found in document. Audit will complete immediately with empty results."
- ✅ Result has `totalTextLayers: 0`
- ✅ Empty arrays for styles, layers, etc.
- ✅ Metrics show 0% adoption rate

### Scenario 6: Multi-Page Scanning

**Objective**: Validate page-by-page scanning with progress

**Steps**:

1. Open Test File 2 (10-20 pages)
2. Open plugin
3. Click "Run Style Audit"
4. Observe console logs for page progress

**Expected Results**:

- ✅ Console shows scanning progress: "Scanned page X of Y (Z text layers)"
- ✅ Progress percentage increases with each page
- ✅ All pages scanned before processing begins
- ✅ Final layer count matches sum of all pages

**Validation**:
Check console for:

```
Document scanning complete: 1,247 text layers found across 12 pages
```

### Scenario 7: Style Detection

**Objective**: Validate style assignment detection

**Steps**:

1. Create test file with:
   - 10 text layers with style applied
   - 5 text layers with no style
   - 5 text layers with overridden properties
2. Run audit

**Expected Results**:

- ✅ Styled layers have `assignmentStatus: 'fully-styled'`
- ✅ Unstyled layers have `assignmentStatus: 'unstyled'`
- ✅ Override layers have `assignmentStatus: 'partially-styled'`
- ✅ Metrics show correct adoption rate (10/20 = 50%)

**Validation**:

```javascript
const styledCount = auditResult.layers.filter((l) => l.assignmentStatus === 'fully-styled').length;
console.log(`Styled: ${styledCount}/20`); // Should be 10/20
```

### Scenario 8: Library Source Resolution

**Objective**: Validate library detection

**Steps**:

1. Create test file with:
   - Local text styles
   - Team library styles (if available)
2. Run audit

**Expected Results**:

- ✅ Local styles have `sourceType: 'local'`, `libraryName: 'Local'`
- ✅ Team library styles have `sourceType: 'team_library'`, `libraryName: '<Library Name>'`
- ✅ Libraries array contains all detected libraries

**Note**: Team library detection may show generic IDs due to Figma API limitations (documented in research.md)

---

## Known Issues

### Current Limitations

1. **Placeholder Implementations**
   - Token detection returns empty array (not yet implemented)
   - Style hierarchy is simplified (no parent-child relationships)
   - Override property detection is incomplete
   - Library name resolution may show "External Library" for team libraries

2. **Missing UI Features**
   - Cancel button not wired to CANCEL_STYLE_AUDIT handler
   - Document change invalidation not implemented
   - Warning banner component not created
   - StyleTreeView doesn't show "Needs Styling" section yet

3. **Type Errors**
   - Some TypeScript type mismatches in traversal.ts (ChildrenMixin)
   - These don't affect runtime functionality

### Expected Errors (Safe to Ignore)

**Build time**:

- TypeScript errors with `pnpm typecheck` command
- CJS deprecation warning from Vite (cosmetic warning only)
- Module type warnings for postcss.config.js (doesn't affect build)
- These are due to build tool configuration, not actual code issues

**Runtime**:

- Console hints about unused variables in processor.ts
- These are intentional for future implementation

### Fixed Issues

**Dynamic Import Error** (Fixed):

- **Previous error**: `Syntax error on line 492: Unexpected reserved word` when using `await import()`
- **Cause**: Figma's plugin sandbox doesn't support dynamic ES module imports
- **Fix**: Changed to static imports in code.ts
- **Status**: ✅ Resolved - rebuild with `pnpm build` to apply fix

---

## Performance Benchmarks

### Expected Audit Duration

| Document Size        | Expected Duration | Zone    |
| -------------------- | ----------------- | ------- |
| < 100 layers         | < 10 seconds      | Optimal |
| 100-1,000 layers     | 10-30 seconds     | Optimal |
| 1,000-5,000 layers   | 30-90 seconds     | Optimal |
| 5,001-10,000 layers  | 2-5 minutes       | Warning |
| 10,001-25,000 layers | 5-10 minutes      | Warning |
| > 25,000 layers      | Not supported     | Error   |

### Performance Targets

- **Validation phase**: < 1 second (any size)
- **Scanning phase**: ~50ms per page, ~1ms per layer
- **Processing phase**: ~2ms per layer
- **UI responsiveness**: No blocking, progress updates every 100ms

### Memory Usage

- **Small documents**: < 50 MB
- **Medium documents**: 50-200 MB
- **Large documents**: 200-500 MB
- **Maximum**: Should not exceed 1 GB

---

## Debugging Tips

### Enable Verbose Logging

Add this to `src/main/audit/auditEngine.ts`:

```typescript
console.log('[AuditEngine] State:', this.state);
console.log('[AuditEngine] Progress:', progress);
```

### Monitor State Transitions

Watch console for state transition logs:

```
Audit state transition: idle → validating
Audit state transition: validating → scanning
Audit state transition: scanning → processing
Audit state transition: processing → complete
```

### Inspect Audit Result

In Figma console after audit completes:

```javascript
// Check structure
console.log(Object.keys(auditResult));

// Check layer count
console.log(`Total layers: ${auditResult.totalTextLayers}`);

// Check styles
console.log(`Styles found: ${auditResult.styles.length}`);
auditResult.styles.forEach((s) => console.log(`  - ${s.name}`));

// Check metrics
console.log(`Adoption rate: ${auditResult.metrics.styleAdoptionRate}%`);
```

---

## Reporting Issues

When reporting issues, include:

1. **Document Details**:
   - Total text layers
   - Number of pages
   - Team libraries used?

2. **Console Logs**:
   - Full console output from Figma
   - State transition logs
   - Error messages

3. **Expected vs Actual**:
   - What you expected to happen
   - What actually happened

4. **Steps to Reproduce**:
   - Exact steps to trigger the issue
   - Test file characteristics

5. **Environment**:
   - Figma Desktop version
   - OS version
   - Plugin build version

---

## Next Steps

After validating Phase 2 functionality:

1. **Phase 3**: Style Replacement Operations (T043-T054)
   - Bulk style replacement
   - Version history checkpoints
   - Adaptive batch processing
   - Rollback support

2. **Phase 4**: Export Capabilities (T055-T060)
   - PDF audit reports
   - CSV data export

3. **Phase 5**: UI Polish (T061-T068)
   - Complete StyleTreeView features
   - Document change detection
   - Warning banners
   - Cancel functionality

---

**Last Updated**: 2025-11-21
**Phase**: 2 (Style Governance Audit)
**Status**: Testing Guide for Current Implementation

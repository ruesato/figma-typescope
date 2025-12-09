# Browser Compatibility

This document outlines browser compatibility for Typescope's performance optimization features and API usage.

## Performance APIs

### performance.memory (Chrome-only)

**Status**: Chrome/Edge only
**Fallback**: Returns zeros in Firefox/Safari
**Impact**: Memory profiling unavailable in non-Chrome browsers

This API provides heap memory information critical for detecting memory leaks and tracking memory usage patterns during document audits.

**Code Location**: `src/ui/utils/performanceProfiler.ts:28-30`

```typescript
// Memory profiling gracefully falls back to zero values
const memoryInfo = performance.memory || { usedJSHeapSize: 0, jsHeapSizeLimit: 0 };
```

**Recommendation**: Use Chrome for production deployments where memory monitoring is critical.

---

### requestIdleCallback

**Status**: Widely supported (95%+ browsers)
**Fallback**: setTimeout with 0ms delay
**Impact**: Slightly less efficient batch scheduling in older browsers

This API enables background batch processing of large datasets without blocking the UI thread.

**Code Location**: `src/main/utils/progressiveBatchLoader.ts:105-123`

```typescript
// Fallback to setTimeout if requestIdleCallback unavailable
const schedule = typeof requestIdleCallback !== 'undefined'
  ? requestIdleCallback
  : (cb) => setTimeout(cb, 0);
```

**Recommendation**: Supported in all modern browsers. Fallback ensures graceful degradation.

---

### performance.mark() / performance.measure()

**Status**: Widely supported (95%+ browsers)
**Usage**: Timing measurements for performance monitoring
**Fallback**: Direct performance.now() usage

Used throughout the codebase for measuring operation durations.

---

## Minimum Browser Versions

| Browser | Version | Release Date | Notes |
|---------|---------|--------------|-------|
| Chrome | 87+ | Nov 2020 | Full feature support |
| Edge | 87+ | Nov 2020 | Full feature support |
| Firefox | 90+ | Jun 2021 | No memory.performance API |
| Safari | 14+ | Nov 2020 | No memory.performance API |

---

## Feature Matrix

| Feature | Chrome | Edge | Firefox | Safari | Notes |
|---------|--------|------|---------|--------|-------|
| performance.memory | ✅ | ✅ | ❌ | ❌ | Memory profiling Chrome-only |
| requestIdleCallback | ✅ | ✅ | ✅ | ✅ | Widely supported |
| performance.mark/measure | ✅ | ✅ | ✅ | ✅ | Timing metrics |
| TanStack Virtual | ✅ | ✅ | ✅ | ✅ | Virtualization works everywhere |
| requestAnimationFrame | ✅ | ✅ | ✅ | ✅ | Scroll monitoring |

---

## Known Issues by Browser

### Firefox
- No `performance.memory` API: Memory profiling unavailable
- Mitigation: Performance monitoring data will show zeros for memory metrics
- Recommendation: Use Chrome for detailed memory analysis

### Safari
- No `performance.memory` API: Memory profiling unavailable
- Mitigation: Same as Firefox
- Recommendation: Use Chrome for detailed memory analysis

### Older Browsers (pre-2020)
- No `requestIdleCallback`: Falls back to setTimeout
- Slightly less efficient batch scheduling
- All features still functional

---

## Testing Recommendations

### Primary Testing
- **Browser**: Chrome/Edge
- **Focus**: Full feature validation, memory profiling, performance metrics
- **Dataset**: 10k+ layers to validate enterprise zone

### Validation Testing
- **Browsers**: Firefox, Safari
- **Focus**: Verify fallbacks work, UI remains responsive
- **Dataset**: 5k layers (typical workload)
- **Metrics to Check**:
  - No console errors
  - Virtualization works smoothly
  - Batch processing completes
  - UI remains responsive during audits

### Deployment Checklist
- [ ] Chrome/Edge: Full test on 50k layer document
- [ ] Firefox: Functional test on 10k layer document
- [ ] Safari: Functional test on 10k layer document
- [ ] Mobile Safari: Responsive layout verification
- [ ] No console errors in any browser
- [ ] Performance acceptable (scroll 60fps on target browsers)

---

## Performance Targets by Browser

| Browser | Target | Notes |
|---------|--------|-------|
| Chrome/Edge | 10k layers @ 60fps | Optimal performance |
| Firefox | 10k layers @ 55fps | Slightly slower, no memory API |
| Safari | 10k layers @ 55fps | Slightly slower, no memory API |
| Mobile Safari | 5k layers @ 55fps | Limited memory/CPU |

---

## Recommendations for Users

### Recommended Setup
- **Browser**: Chrome or Edge (latest version)
- **Reason**: Full feature support, memory profiling, best performance
- **Use Case**: Production deployments, enterprise audits

### Alternative Browsers
- **Firefox/Safari**: Works well for typical documents (5k-10k layers)
- **Limitation**: Memory profiling unavailable
- **Use Case**: General usage, testing, development

### Not Recommended
- **Internet Explorer 11**: Not tested, likely incompatible
- **Older Browsers**: Missing critical APIs

---

## Graceful Degradation

The plugin is designed to work across all modern browsers with graceful fallbacks:

1. **Memory API**: Falls back to zero values (no error)
2. **requestIdleCallback**: Falls back to setTimeout (slightly slower)
3. **Virtualization**: Works in all browsers
4. **Performance monitoring**: Partial data in non-Chrome browsers

Users will experience full functionality across all modern browsers, with reduced memory profiling capabilities in Firefox/Safari.

---

## Future Improvements

- [ ] Add feature detection and user warnings in UI
- [ ] Implement alternative memory tracking for Firefox/Safari
- [ ] Add browser compatibility badge to help panel
- [ ] Monitor real-world performance metrics across browsers
- [ ] Consider IndexedDB for persistent memory tracking

---

## References

- [MDN: performance.memory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory)
- [MDN: requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)
- [Can I Use: requestIdleCallback](https://caniuse.com/requestidlecallback)
- [Can I Use: performance.memory](https://caniuse.com/mdn-api_performance_memory)


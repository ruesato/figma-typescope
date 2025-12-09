/**
 * Accessibility Utilities
 *
 * Helper functions for ARIA labels, keyboard navigation, and screen reader support.
 * Ensures plugin is fully accessible for users with disabilities.
 */

// ============================================================================
// ARIA Labels for Tree Nodes (T111)
// ============================================================================

/**
 * Generate ARIA label for style tree node
 */
export function generateStyleNodeAriaLabel(
  styleName: string,
  usageCount: number,
  isExpanded: boolean,
  level: number = 0
): string {
  const expandedState = isExpanded ? 'expanded' : 'collapsed';
  const usageText = usageCount === 1 ? '1 usage' : `${usageCount} usages`;
  const indent = 'Level ' + (level + 1);

  return `${styleName}, ${usageText}, ${expandedState}, ${indent}`;
}

/**
 * Generate ARIA label for token tree node
 */
export function generateTokenNodeAriaLabel(
  tokenName: string,
  usageCount: number,
  isExpanded: boolean,
  collection: string
): string {
  const expandedState = isExpanded ? 'expanded' : 'collapsed';
  const usageText = usageCount === 1 ? '1 usage' : `${usageCount} usages`;

  return `${tokenName}, ${usageText}, ${expandedState}, ${collection}`;
}

/**
 * Generate ARIA label for expandable section
 */
export function generateSectionAriaLabel(
  sectionName: string,
  itemCount: number,
  isExpanded: boolean
): string {
  const expandedState = isExpanded ? 'expanded' : 'collapsed';
  const itemText = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return `${sectionName}, ${itemText}, ${expandedState}`;
}

// ============================================================================
// ARIA Labels for Buttons (T112)
// ============================================================================

/**
 * Generate ARIA label for action buttons
 */
export function generateButtonAriaLabel(
  action: string,
  context?: string,
  isDisabled?: boolean
): string {
  let label = action;

  if (context) {
    label += ` - ${context}`;
  }

  if (isDisabled) {
    label += ' (disabled)';
  }

  return label;
}

/**
 * Specific button ARIA labels
 */
export const buttonAriaLabels = {
  runAudit: () => generateButtonAriaLabel('Run Audit', 'Analyze all text styles in document'),
  cancelAudit: () => generateButtonAriaLabel('Cancel Audit'),
  replaceStyle: (styleName: string) =>
    generateButtonAriaLabel('Replace Style', `Replace ${styleName}`),
  replaceToken: (tokenName: string) =>
    generateButtonAriaLabel('Replace Token', `Replace ${tokenName}`),
  exportPDF: () => generateButtonAriaLabel('Export PDF', 'Download audit report as PDF'),
  exportCSV: () => generateButtonAriaLabel('Export CSV', 'Download audit data as CSV'),
  reRunAudit: () => generateButtonAriaLabel('Re-run Audit', 'Update results with current document'),
  navigateToLayer: (layerName: string) =>
    generateButtonAriaLabel('Navigate to Layer', `Go to ${layerName} in canvas`),
  dismiss: () => generateButtonAriaLabel('Dismiss'),
  confirm: (action: string) => generateButtonAriaLabel('Confirm', action),
  cancel: () => generateButtonAriaLabel('Cancel'),
};

// ============================================================================
// Keyboard Navigation Support (T117-T118)
// ============================================================================

/**
 * Keyboard shortcut definitions
 */
export const keyboardShortcuts = {
  expand: { key: 'Space', description: 'Expand/collapse tree node' },
  select: { key: 'Enter', description: 'Select tree node or activate button' },
  navigateUp: { key: '↑', description: 'Navigate to previous tree node' },
  navigateDown: { key: '↓', description: 'Navigate to next tree node' },
  navigateLeft: { key: '←', description: 'Collapse tree node or navigate to parent' },
  navigateRight: { key: '→', description: 'Expand tree node' },
  search: { key: 'Ctrl+F / Cmd+F', description: 'Open search' },
  closeDialog: { key: 'Esc', description: 'Close dialog or modal' },
  tabNavigation: { key: 'Tab', description: 'Move between sections' },
  shiftTab: { key: 'Shift+Tab', description: 'Move to previous section' },
};

/**
 * Format keyboard shortcuts for display
 */
export function formatKeyboardShortcutsDisplay(): string {
  return Object.entries(keyboardShortcuts)
    .map(([_, { key, description }]) => `${key}: ${description}`)
    .join('\n');
}

/**
 * Get keyboard shortcut help text
 */
export function getKeyboardNavigationHint(): string {
  return 'Use keyboard to navigate: Space to expand, Enter to select, Arrow keys to move, Esc to close';
}

/**
 * Check if event matches keyboard shortcut
 */
export function matchesKeyboardShortcut(
  event: KeyboardEvent,
  shortcutKey: string
): boolean {
  const key = event.key;
  const isCtrlCmd = event.ctrlKey || event.metaKey;

  switch (shortcutKey) {
    case 'Space':
      return key === ' ';
    case 'Enter':
      return key === 'Enter';
    case 'ArrowUp':
      return key === 'ArrowUp';
    case 'ArrowDown':
      return key === 'ArrowDown';
    case 'ArrowLeft':
      return key === 'ArrowLeft';
    case 'ArrowRight':
      return key === 'ArrowRight';
    case 'Escape':
      return key === 'Escape';
    case 'Tab':
      return key === 'Tab';
    case 'Ctrl+F':
      return isCtrlCmd && key === 'f';
    default:
      return false;
  }
}

// ============================================================================
// Focus Management (T113)
// ============================================================================

/**
 * Manage focus for modals and dialogs
 */
export class FocusManager {
  private previouslyFocusedElement: HTMLElement | null = null;
  private focusedElement: HTMLElement | null = null;

  /**
   * Save current focus before opening modal
   */
  saveFocus(): void {
    this.previouslyFocusedElement = document.activeElement as HTMLElement;
  }

  /**
   * Trap focus within modal
   */
  trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    // Shift+Tab (backwards)
    if (event.shiftKey) {
      if (activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      // Tab (forwards)
      if (activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }

  /**
   * Restore focus to previously focused element
   */
  restoreFocus(): void {
    if (this.previouslyFocusedElement) {
      this.previouslyFocusedElement.focus();
      this.previouslyFocusedElement = null;
    }
  }

  /**
   * Get all focusable elements within a container
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];

    const selector = focusableSelectors.join(', ');
    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }
}

// ============================================================================
// Screen Reader Announcements (T114)
// ============================================================================

/**
 * Announce messages to screen readers via ARIA live regions
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Specific screen reader announcements
 */
export const screenReaderAnnouncements = {
  auditStarted: () => announceToScreenReader('Audit started. Processing document...'),
  auditComplete: (count: number) =>
    announceToScreenReader(`Audit complete. Found ${count} styles.`, 'assertive'),
  auditCancelled: () => announceToScreenReader('Audit cancelled.'),
  scanningPage: (currentPage: number, totalPages: number) =>
    announceToScreenReader(`Scanning page ${currentPage} of ${totalPages}`),
  processingLayers: (currentLayer: number, totalLayers: number) =>
    announceToScreenReader(`Processing layer ${currentLayer} of ${totalLayers}`),
  replacementStarted: () => announceToScreenReader('Replacement started. Creating checkpoint...'),
  replacementComplete: (count: number) =>
    announceToScreenReader(`Replacement complete. Updated ${count} layers.`, 'assertive'),
  replacementFailed: (error: string) =>
    announceToScreenReader(`Replacement failed: ${error}`, 'assertive'),
  styleSelected: (styleName: string) =>
    announceToScreenReader(`Selected ${styleName}`),
  resultsSorted: (sortBy: string) =>
    announceToScreenReader(`Results sorted by ${sortBy}`),
  resultsFiltered: (count: number) =>
    announceToScreenReader(`Showing ${count} results`),
};

// ============================================================================
// Skip Links and Navigation
// ============================================================================

/**
 * Generate skip link for keyboard navigation
 */
export function createSkipLinks(): Array<{ label: string; anchor: string }> {
  return [
    { label: 'Skip to main content', anchor: '#main-content' },
    { label: 'Skip to search', anchor: '#search' },
    { label: 'Skip to results', anchor: '#results' },
  ];
}

/**
 * Check focus visibility
 */
export function hasFocusVisible(element: HTMLElement): boolean {
  return element.matches(':focus-visible');
}

// ============================================================================
// Semantic HTML Helpers
// ============================================================================

/**
 * Generate semantic landmark labels
 */
export const landmarkLabels = {
  main: 'Main content',
  navigation: 'Navigation',
  search: 'Search',
  complementary: 'Sidebar',
  contentinfo: 'Footer',
};

/**
 * Check ARIA attributes completeness
 */
export function validateAriaAttributes(element: HTMLElement): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check buttons have accessible names
  if (element.tagName === 'BUTTON' && !element.getAttribute('aria-label') && !element.textContent?.trim()) {
    issues.push('Button should have aria-label or text content');
  }

  // Check images have alt text or aria-label
  if (element.tagName === 'IMG' && !element.getAttribute('alt') && !element.getAttribute('aria-label')) {
    issues.push('Image should have alt text or aria-label');
  }

  // Check form inputs have labels
  if (element.tagName === 'INPUT' && !element.getAttribute('aria-label') && !element.closest('label')) {
    issues.push('Input should have aria-label or be associated with label');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

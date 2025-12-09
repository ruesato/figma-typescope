/**
 * Edge Case Handling Utilities
 *
 * Comprehensive error handling and edge case management for all audit scenarios.
 * Handles: empty documents, zero-usage styles, missing styles, network issues,
 * interrupted operations, validation failures, nested components, team libraries,
 * mixed token modes, document changes.
 */

import type {
  StyleGovernanceAuditResult,
  TextLayer,
  TextStyle,
  DesignToken,
  AuditError,
} from '@/shared/types';

// ============================================================================
// Edge Case: Empty Document (T101)
// ============================================================================

/**
 * Check if audit result is empty and provide appropriate messaging
 */
export function isEmptyAuditResult(result: Partial<StyleGovernanceAuditResult>): boolean {
  return !result.totalTextLayers || result.totalTextLayers === 0;
}

/**
 * Get user-friendly message for empty document scenarios
 */
export function getEmptyDocumentMessage(): string {
  return 'No text layers found in document. Run audit to populate results.';
}

/**
 * Validate document has content before processing
 */
export function validateDocumentHasContent(totalTextLayers: number): {
  valid: boolean;
  warning?: string;
} {
  if (totalTextLayers === 0) {
    return {
      valid: false,
      warning: getEmptyDocumentMessage(),
    };
  }
  return { valid: true };
}

// ============================================================================
// Edge Case: Zero Usage Style (T102)
// ============================================================================

/**
 * Filter styles and mark unused ones
 */
export function categorizeStylesByUsage(styles: TextStyle[]): {
  used: TextStyle[];
  unused: TextStyle[];
} {
  return {
    used: styles.filter((s) => s.usageCount > 0),
    unused: styles.filter((s) => s.usageCount === 0),
  };
}

/**
 * Get badge text for unused styles
 */
export function getUnusedStyleBadgeText(): string {
  return 'Unused';
}

/**
 * Format zero-usage style display
 */
export function formatZeroUsageStyleMessage(styleName: string): string {
  return `${styleName} (0 usages)`;
}

// ============================================================================
// Edge Case: Deleted/Missing Style (T103)
// ============================================================================

/**
 * Detect if a style is deleted/missing from library
 */
export function isStyleMissing(styleId: string | undefined, styleExists: boolean): boolean {
  return styleId !== undefined && !styleExists;
}

/**
 * Mark layers with deleted styles
 */
export function markLayersWithMissingStyles(
  layers: TextLayer[]
): Array<TextLayer & { hasDeletedStyle?: boolean }> {
  return layers.map((layer) => {
    // Check if style ID exists but style not found in inventory
    const hasDeletedStyle = layer.styleId !== undefined && !layer.styleName;
    return {
      ...layer,
      hasDeletedStyle,
    };
  });
}

/**
 * Get warning message for missing style
 */
export function getMissingStyleWarning(styleName: string): string {
  return `Assigned style "${styleName}" no longer exists in library`;
}

/**
 * Get tooltip for deleted style indicator
 */
export function getDeletedStyleTooltip(): string {
  return 'Assigned style no longer exists. Consider reassigning to active style.';
}

// ============================================================================
// Edge Case: Network Issues (T104)
// ============================================================================

/**
 * Classify error type for appropriate handling
 */
export function classifyNetworkError(error: Error): 'permission' | 'network' | 'unknown' {
  const message = error.message.toLowerCase();

  if (message.includes('permission') || message.includes('access denied')) {
    return 'permission';
  }

  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('unavailable')
  ) {
    return 'network';
  }

  return 'unknown';
}

/**
 * Get user-friendly message for library access failure
 */
export function getLibraryAccessErrorMessage(libraryName: string): string {
  return `Team library "${libraryName}" unavailable. Showing local styles only. Some team library styles may not be visible.`;
}

/**
 * Determine if audit can continue with partial library data
 */
export function canContinueWithoutTeamLibraries(): boolean {
  return true; // Always allow local-only audit
}

/**
 * Get fallback message when team libraries fail
 */
export function getFallbackLibraryMessage(): string {
  return 'Some team libraries unavailable. Showing local styles only.';
}

// ============================================================================
// Edge Case: Replacement Interruption (T105)
// ============================================================================

/**
 * Get recovery message for interrupted operations
 */
export function getInterruptionRecoveryMessage(): string {
  return 'Operation interrupted. Use File > Version History to rollback to your checkpoint, or continue using the updated styles.';
}

/**
 * Check if operation has checkpoint available
 */
export function hasCheckpoint(checkpointTitle: string | undefined): boolean {
  return checkpointTitle !== undefined && checkpointTitle.length > 0;
}

/**
 * Format checkpoint information for user
 */
export function formatCheckpointInfo(checkpointTitle: string, timestamp: Date): string {
  return `Checkpoint: "${checkpointTitle}" at ${timestamp.toLocaleTimeString()}`;
}

// ============================================================================
// Edge Case: Same Source/Target Validation (T106)
// ============================================================================

/**
 * Validate source and target are different
 */
export function validateSourceTargetDifferent(
  sourceId: string,
  targetId: string
): { valid: boolean; error?: string } {
  if (sourceId === targetId) {
    return {
      valid: false,
      error: 'Source and target styles cannot be the same. Please select a different target style.',
    };
  }
  return { valid: true };
}

/**
 * Get error message for same source/target
 */
export function getSameSourceTargetErrorMessage(): string {
  return 'Cannot replace a style with itself. Select a different target style.';
}

// ============================================================================
// Edge Case: Nested Components (T107)
// ============================================================================

/**
 * Detect nested component structure
 */
export function isInNestedComponent(componentPath: string | undefined): boolean {
  if (!componentPath) return false;
  const pathSegments = componentPath.split('/');
  return pathSegments.length > 2;
}

/**
 * Get nesting level
 */
export function getComponentNestingLevel(componentPath: string | undefined): number {
  if (!componentPath) return 0;
  return componentPath.split('/').length - 1;
}

/**
 * Format nested component path for display
 */
export function formatComponentPath(componentPath: string | undefined): string {
  if (!componentPath) return 'Root';
  const segments = componentPath.split('/');
  return segments[segments.length - 1]; // Show leaf component only
}

/**
 * Get full path for tooltip
 */
export function formatComponentHierarchy(componentPath: string | undefined): string {
  if (!componentPath) return 'Root layer';
  return componentPath.split('/').join(' > ');
}

// ============================================================================
// Edge Case: Multiple Team Libraries (T108)
// ============================================================================

/**
 * Group libraries for display
 */
export function groupLibrariesByType(libraryNames: string[]): {
  local: string[];
  teamLibraries: string[];
} {
  return {
    local: libraryNames.filter((name) => name === 'Local'),
    teamLibraries: libraryNames.filter((name) => name !== 'Local'),
  };
}

/**
 * Get library display with badge
 */
export function getLibraryDisplayLabel(libraryName: string, isLocal: boolean): string {
  return isLocal ? `${libraryName} (Local)` : `${libraryName} (Team)`;
}

/**
 * Count libraries for summary
 */
export function countLibraries(libraryNames: string[]): { total: number; team: number } {
  const grouped = groupLibrariesByType(libraryNames);
  return {
    total: libraryNames.length,
    team: grouped.teamLibraries.length,
  };
}

// ============================================================================
// Edge Case: Mixed Token Modes (T109)
// ============================================================================

/**
 * Detect if token has multiple modes
 */
export function isMultiModeToken(token: DesignToken): boolean {
  return (
    token.valuesByMode && Object.keys(token.valuesByMode).length > 1
  );
}

/**
 * Get all modes for token
 */
export function getTokenModes(token: DesignToken): string[] {
  if (!token.valuesByMode) return [token.modeName];
  return Object.keys(token.valuesByMode);
}

/**
 * Get token value for specific mode
 */
export function getTokenValueByMode(token: DesignToken, modeName: string): any {
  if (token.modeName === modeName) {
    return token.currentValue;
  }
  return token.valuesByMode?.[modeName];
}

/**
 * Format multi-mode token info
 */
export function formatMultiModeTokenInfo(token: DesignToken): string {
  const modes = getTokenModes(token);
  if (modes.length <= 1) return `${token.modeName}`;
  return `${token.modeName} (${modes.length} modes)`;
}

/**
 * Get mode value display
 */
export function formatTokenModeValue(modeName: string, value: any): string {
  return `${modeName}: ${String(value)}`;
}

// ============================================================================
// Edge Case: Document Changes During Audit (T110)
// ============================================================================

/**
 * Detect if document has changed since audit started
 */
export function hasDocumentChanged(
  auditTimestamp: Date,
  lastModifiedTimestamp: Date | undefined
): boolean {
  if (!lastModifiedTimestamp) return false;
  return lastModifiedTimestamp > auditTimestamp;
}

/**
 * Get stale result warning message
 */
export function getStaleResultWarning(): string {
  return 'Document has been modified since audit was run. Audit results may be outdated.';
}

/**
 * Format time since audit for display
 */
export function formatTimeSinceAudit(auditTimestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - auditTimestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

/**
 * Get re-run audit prompt message
 */
export function getReRunAuditPrompt(): string {
  return 'Re-run audit to see updated results with current document state.';
}

// ============================================================================
// General Error Handling
// ============================================================================

/**
 * Create audit error object
 */
export function createAuditError(
  message: string,
  errorType: 'VALIDATION' | 'API' | 'UNKNOWN' = 'UNKNOWN',
  nodeId?: string
): AuditError {
  return {
    message,
    errorType,
    nodeId,
    retryAttempts: 0,
  };
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message;

  if (message.includes('No text layers')) {
    return 'No text layers found in document. Audit complete with no results.';
  }

  if (message.includes('Document too large')) {
    return 'Document exceeds maximum size. Please split into smaller documents.';
  }

  if (message.includes('permission') || message.includes('access')) {
    return 'Permission denied. You may not have edit access to this document.';
  }

  if (message.includes('timeout') || message.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  return message;
}

// ============================================================================
// Helpful Suggestions
// ============================================================================

/**
 * Get helpful suggestion based on error type
 */
export function getErrorSuggestion(errorType: string): string {
  switch (errorType) {
    case 'VALIDATION':
      return 'Try running the audit again or check document permissions.';
    case 'API':
      return 'Check your internet connection and try again.';
    default:
      return 'Contact support if the problem persists.';
  }
}

/**
 * Get suggestion for empty results
 */
export function getSuggestionForEmptyResults(): string {
  return 'Make sure the page contains text layers. Text inside components or groups may not be detected.';
}

/**
 * Get suggestion for zero-usage styles
 */
export function getSuggestionForZeroUsageStyles(): string {
  return 'Consider removing unused styles from your library to reduce clutter.';
}

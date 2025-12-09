/**
 * Error Messages Utility
 *
 * Centralized, user-friendly error messages with actionable suggestions.
 * Ensures consistent error communication across the plugin.
 */

export type ErrorCategory =
  | 'validation'
  | 'permission'
  | 'network'
  | 'api'
  | 'timeout'
  | 'not-found'
  | 'conflict'
  | 'unknown';

export interface ErrorMessage {
  message: string;
  suggestion: string;
  category: ErrorCategory;
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// Error Message Catalog
// ============================================================================

const errorCatalog: Record<string, ErrorMessage> = {
  // Validation Errors
  'NO_TEXT_LAYERS': {
    message: 'No text layers found in document',
    suggestion: 'Add text to your design and try again',
    category: 'validation',
    severity: 'warning',
  },
  'DOCUMENT_TOO_LARGE': {
    message: 'Document exceeds maximum size (25,000 text layers)',
    suggestion: 'Split into smaller documents or run audit on specific pages',
    category: 'validation',
    severity: 'error',
  },
  'EMPTY_SELECTION': {
    message: 'Selection contains no text layers',
    suggestion: 'Select frames or groups containing text layers',
    category: 'validation',
    severity: 'warning',
  },
  'INVALID_LAYER_ID': {
    message: 'Invalid layer ID format',
    suggestion: 'Report this issue if it persists',
    category: 'validation',
    severity: 'error',
  },
  'INVALID_STYLE_ID': {
    message: 'Style not found or invalid',
    suggestion: 'Ensure the style still exists in your document',
    category: 'validation',
    severity: 'error',
  },
  'SAME_SOURCE_TARGET': {
    message: 'Source and target cannot be the same',
    suggestion: 'Select a different target style for replacement',
    category: 'conflict',
    severity: 'warning',
  },

  // Permission Errors
  'PERMISSION_DENIED': {
    message: 'You do not have permission to edit this document',
    suggestion: 'Ask the file owner to grant you edit access',
    category: 'permission',
    severity: 'error',
  },
  'READ_ONLY_DOCUMENT': {
    message: 'Document is read-only',
    suggestion: 'Request edit access from the file owner',
    category: 'permission',
    severity: 'error',
  },
  'LIBRARY_ACCESS_DENIED': {
    message: 'Cannot access team library',
    suggestion: 'Check that you have access to the team library',
    category: 'permission',
    severity: 'warning',
  },

  // Network Errors
  'NETWORK_ERROR': {
    message: 'Network connection error',
    suggestion: 'Check your internet connection and try again',
    category: 'network',
    severity: 'error',
  },
  'LIBRARY_UNAVAILABLE': {
    message: 'Team library is temporarily unavailable',
    suggestion: 'Showing local styles only. Try again in a moment',
    category: 'network',
    severity: 'warning',
  },
  'TIMEOUT': {
    message: 'Operation timed out',
    suggestion: 'Try again or split into smaller batches',
    category: 'timeout',
    severity: 'error',
  },

  // API Errors
  'API_ERROR': {
    message: 'Figma API error',
    suggestion: 'Try again or report if the problem persists',
    category: 'api',
    severity: 'error',
  },
  'STYLE_NOT_FOUND': {
    message: 'Text style does not exist',
    suggestion: 'Verify the style name is correct',
    category: 'not-found',
    severity: 'error',
  },
  'TOKEN_NOT_FOUND': {
    message: 'Design token not found',
    suggestion: 'Verify the token exists in your collections',
    category: 'not-found',
    severity: 'error',
  },
  'PAGE_NOT_FOUND': {
    message: 'Page not found',
    suggestion: 'The page may have been deleted. Try running audit again',
    category: 'not-found',
    severity: 'error',
  },

  // Replacement Errors
  'REPLACEMENT_FAILED': {
    message: 'Failed to replace styles in some layers',
    suggestion: 'Check the rollback checkpoint to recover previous state',
    category: 'api',
    severity: 'error',
  },
  'PARTIAL_REPLACEMENT': {
    message: 'Replacement completed with some failures',
    suggestion: 'Review failed layers and retry if needed',
    category: 'warning',
    severity: 'warning',
  },
  'CHECKPOINT_FAILED': {
    message: 'Could not create version history checkpoint',
    suggestion: 'Operation cancelled for safety. Try again',
    category: 'api',
    severity: 'error',
  },

  // Audit Errors
  'AUDIT_CANCELLED': {
    message: 'Audit was cancelled',
    suggestion: 'Click "Run Audit" to start again',
    category: 'info',
    severity: 'info',
  },
  'AUDIT_FAILED': {
    message: 'Audit failed unexpectedly',
    suggestion: 'Try running the audit again or check document permissions',
    category: 'unknown',
    severity: 'error',
  },

  // Export Errors
  'EXPORT_FAILED': {
    message: 'Could not generate export file',
    suggestion: 'Try again or report if the problem persists',
    category: 'api',
    severity: 'error',
  },
  'PDF_GENERATION_FAILED': {
    message: 'PDF generation failed',
    suggestion: 'Try exporting as CSV instead',
    category: 'api',
    severity: 'error',
  },
  'CSV_GENERATION_FAILED': {
    message: 'CSV generation failed',
    suggestion: 'Try exporting as PDF instead',
    category: 'api',
    severity: 'error',
  },

  // Unknown Errors
  'UNKNOWN_ERROR': {
    message: 'An unexpected error occurred',
    suggestion: 'Try again or report this issue on GitHub',
    category: 'unknown',
    severity: 'error',
  },
};

// ============================================================================
// Error Message API
// ============================================================================

/**
 * Get error message by error code
 */
export function getErrorMessage(errorCode: string): ErrorMessage {
  return errorCatalog[errorCode] || errorCatalog['UNKNOWN_ERROR'];
}

/**
 * Get error message from error string
 */
export function classifyErrorMessage(errorText: string): ErrorMessage {
  const lowerText = errorText.toLowerCase();

  // Attempt to classify based on error text patterns
  if (lowerText.includes('permission') || lowerText.includes('access denied')) {
    return errorCatalog['PERMISSION_DENIED'];
  }

  if (lowerText.includes('network') || lowerText.includes('timeout')) {
    return errorCatalog['NETWORK_ERROR'];
  }

  if (lowerText.includes('not found') || lowerText.includes('does not exist')) {
    return errorCatalog['STYLE_NOT_FOUND'];
  }

  if (lowerText.includes('no text') || lowerText.includes('empty')) {
    return errorCatalog['NO_TEXT_LAYERS'];
  }

  if (lowerText.includes('too large') || lowerText.includes('exceed')) {
    return errorCatalog['DOCUMENT_TOO_LARGE'];
  }

  return errorCatalog['UNKNOWN_ERROR'];
}

/**
 * Format error for display in UI
 */
export function formatErrorForDisplay(error: Error | string): { title: string; message: string; suggestion: string } {
  const errorText = typeof error === 'string' ? error : error.message;
  const errorMsg = classifyErrorMessage(errorText);

  return {
    title: 'Error',
    message: errorMsg.message,
    suggestion: errorMsg.suggestion,
  };
}

/**
 * Get error icon based on severity
 */
export function getErrorIcon(severity: 'info' | 'warning' | 'error'): string {
  switch (severity) {
    case 'info':
      return 'ℹ️';
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
  }
}

/**
 * Get error color class for severity
 */
export function getErrorColorClass(severity: 'info' | 'warning' | 'error'): string {
  switch (severity) {
    case 'info':
      return 'text-blue-600 bg-blue-50';
    case 'warning':
      return 'text-yellow-600 bg-yellow-50';
    case 'error':
      return 'text-red-600 bg-red-50';
  }
}

// ============================================================================
// Helpful Suggestions by Context
// ============================================================================

export const contextualSuggestions = {
  emptyDocument: () => 'Make sure your page contains text layers. Text inside components or groups may need to be audited separately.',
  slowAudit: () => 'Large documents take time to audit. Performance improves with fewer text layers.',
  largeDocument: () => 'This is a large document. The audit may take several minutes. You can view results as they load.',
  noStyles: () => 'This document has no text styles yet. Apply styles to text layers to see them here.',
  noTokens: () => 'This document does not use design tokens. Add variables to text properties to see token usage.',
  replacementFailed: () => 'Check document permissions and try again. A version history checkpoint was created for recovery.',
  networkIssue: () => 'Check your internet connection. Team libraries may be temporarily unavailable.',
};

/**
 * Get suggestion based on context
 */
export function getSuggestionForContext(context: keyof typeof contextualSuggestions): string {
  return contextualSuggestions[context]?.() || 'Try again or report if the problem persists';
}

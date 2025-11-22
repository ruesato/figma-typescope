/**
 * Document Validator for Style Governance Audit
 *
 * Enforces document size limits and accessibility checks:
 * - Warning at 5,001 text layers (Warning Zone)
 * - Hard limit at 25,001 text layers (maximum supported)
 * - Checks document accessibility and permissions
 * - Validates team library availability
 */

export interface ValidationResult {
  isValid: boolean;
  totalTextLayers: number;
  totalPages: number;
  isWarningZone: boolean; // 5k-25k layers
  warnings: string[];
  errors: string[];
}

export interface ValidationOptions {
  includeHiddenLayers?: boolean;
  requireTeamLibraries?: boolean;
}

/**
 * Validate document for audit compatibility
 *
 * @param options - Validation configuration options
 * @returns ValidationResult with detailed status
 */
export async function validateDocument(options: ValidationOptions = {}): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    totalTextLayers: 0,
    totalPages: 0,
    isWarningZone: false,
    warnings: [],
    errors: [],
  };

  try {
    // Check 1: Document accessibility
    if (!figma.root) {
      result.errors.push('Cannot access document root');
      result.isValid = false;
      return result;
    }

    if (!figma.currentPage) {
      result.errors.push('Cannot access current page');
      result.isValid = false;
      return result;
    }

    // Check 2: Page count
    const pages = figma.root.children;
    result.totalPages = pages.length;

    if (pages.length === 0) {
      result.errors.push('Document has no pages');
      result.isValid = false;
      return result;
    }

    // Check 3: Count text layers across all pages
    for (const page of pages) {
      // Load page content to ensure accurate counting
      await figma.loadPageAsync(page);

      // Count text nodes in this page
      const textNodes = page.findAllWithCriteria({
        types: ['TEXT'],
      });

      result.totalTextLayers += textNodes.length;
    }

    // Check 4: Enforce size limits (from spec FR-007e/f/g)
    if (result.totalTextLayers > 25000) {
      result.errors.push(
        `Document too large: ${result.totalTextLayers.toLocaleString()} text layers found. ` +
          'Maximum supported is 25,000 layers. Consider splitting into smaller documents.'
      );
      result.isValid = false;
      return result;
    }

    if (result.totalTextLayers > 5000) {
      result.isWarningZone = true;
      result.warnings.push(
        `Large document detected: ${result.totalTextLayers.toLocaleString()} text layers. ` +
          'Performance may be impacted. Audit may take several minutes.'
      );
    }

    // Check 5: Minimum content validation
    if (result.totalTextLayers === 0) {
      result.warnings.push(
        'No text layers found in document. Audit will complete immediately with empty results.'
      );
    }

    // Check 6: Team library availability (if required)
    if (options.requireTeamLibraries) {
      try {
        // Test team library access
        const teamLibraries = await figma.teamLibrary.getAvailableLibrariesAsync();

        if (teamLibraries.length === 0) {
          result.warnings.push('No team libraries available. Only local styles will be audited.');
        }
      } catch (error) {
        result.warnings.push('Cannot access team libraries. Only local styles will be audited.');
      }
    }

    // Check 7: Document permissions
    try {
      // Test if we can read page content
      const firstPage = pages[0];
      await figma.loadPageAsync(firstPage);

      // Test if we can read styles
      await figma.getLocalTextStylesAsync();

      // Test if we can read variables (tokens)
      if (figma.variables) {
        await figma.variables.getLocalVariablesAsync();
      }
    } catch (error) {
      result.errors.push('Insufficient permissions to read document content or styles.');
      result.isValid = false;
    }
  } catch (error) {
    result.errors.push(
      `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    result.isValid = false;
  }

  return result;
}

/**
 * Get size category for document
 *
 * @param textLayerCount - Number of text layers
 * @returns Size category with performance expectations
 */
export function getSizeCategory(textLayerCount: number): {
  category: 'optimal' | 'warning' | 'unsupported';
  description: string;
  expectedDuration: string;
} {
  if (textLayerCount <= 1000) {
    return {
      category: 'optimal',
      description: 'Optimal document size',
      expectedDuration: '< 30 seconds',
    };
  }

  if (textLayerCount <= 5000) {
    return {
      category: 'optimal',
      description: 'Large but manageable document',
      expectedDuration: '30-90 seconds',
    };
  }

  if (textLayerCount <= 25000) {
    return {
      category: 'warning',
      description: 'Warning Zone - performance impacted',
      expectedDuration: '2-10 minutes',
    };
  }

  return {
    category: 'unsupported',
    description: 'Document too large - not supported',
    expectedDuration: 'N/A',
  };
}

/**
 * Check if document is in Warning Zone (5k-25k layers)
 *
 * @param textLayerCount - Number of text layers
 * @returns true if in Warning Zone
 */
export function isWarningZone(textLayerCount: number): boolean {
  return textLayerCount > 5000 && textLayerCount <= 25000;
}

/**
 * Get performance recommendations based on document size
 *
 * @param textLayerCount - Number of text layers
 * @returns Array of performance recommendations
 */
export function getPerformanceRecommendations(textLayerCount: number): string[] {
  const recommendations: string[] = [];

  if (textLayerCount > 10000) {
    recommendations.push('Consider running audit on individual pages for better performance');
  }

  if (textLayerCount > 15000) {
    recommendations.push('Close other Figma tabs to free up memory');
  }

  if (textLayerCount > 20000) {
    recommendations.push('Consider splitting document into smaller files for optimal performance');
  }

  return recommendations;
}

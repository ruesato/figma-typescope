import type { AuditState, StyleGovernanceAuditResult, MainToUIMessage } from '@/shared/types';

// Figma Plugin API types
declare global {
  const figma: any;
  type TextNode = any;
  type TextStyle = any;
  type FontName = any;
  type Paint = any;
  type SolidPaint = any;
  type LineHeight = any;
}

/**
 * 7-State Audit Engine for Style Governance
 *
 * Implements the state machine defined in the data model:
 * idle → validating → scanning → processing → complete/error/cancelled
 *
 * Each state has specific responsibilities and emits appropriate progress
 * messages to the UI for user feedback.
 */

export class AuditEngine {
  private state: AuditState = 'idle';
  private startTime: number = 0;
  private cancelled: boolean = false;

  // State transition validation (from data-model.md)
  private readonly VALID_TRANSITIONS: Record<AuditState, AuditState[]> = {
    idle: ['validating'],
    validating: ['scanning', 'error'],
    scanning: ['processing', 'error', 'cancelled'],
    processing: ['complete', 'error', 'cancelled'],
    complete: ['idle'],
    error: ['idle'],
    cancelled: ['idle'],
  };

  /**
   * Run complete audit workflow
   *
   * @param options - Audit configuration options
   * @returns Promise<StyleGovernanceAuditResult> - Complete audit result
   */
  async runAudit(
    options: {
      includeHiddenLayers?: boolean;
      includeTokens?: boolean;
    } = {}
  ): Promise<StyleGovernanceAuditResult> {
    // Reset cancellation flag
    this.cancelled = false;
    this.startTime = Date.now();

    try {
      // State 1: VALIDATING
      if (!this.transition('validating')) {
        throw new Error('Cannot start audit: invalid state transition');
      }

      await this.validateDocument(options);

      // State 2: SCANNING
      if (!this.transition('scanning')) {
        throw new Error('Cannot start scanning: invalid state transition');
      }

      const scanResult = await this.scanDocument();

      // State 3: PROCESSING
      if (!this.transition('processing')) {
        throw new Error('Cannot start processing: invalid state transition');
      }

      const auditResult = await this.processScanResults(scanResult, options);

      // State 4: COMPLETE
      if (!this.transition('complete')) {
        throw new Error('Cannot complete audit: invalid state transition');
      }

      const duration = Date.now() - this.startTime;

      // Send final result to UI
      this.sendMessage({
        type: 'STYLE_AUDIT_COMPLETE',
        payload: { result: auditResult, duration },
      });

      return auditResult;
    } catch (error) {
      // Handle cancellation separately
      if (this.cancelled) {
        this.transition('cancelled');
        this.sendMessage({
          type: 'STYLE_AUDIT_CANCELLED',
          payload: {},
        });
        throw new Error('Audit cancelled by user');
      }

      // Handle other errors
      this.transition('error');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      this.sendMessage({
        type: 'STYLE_AUDIT_ERROR',
        payload: {
          error: errorMessage,
          errorType: 'unknown',
          canRetry: true,
          details: error instanceof Error ? error.stack : undefined,
        },
      });

      throw error;
    }
  }

  /**
   * Cancel the current audit operation
   *
   * Can only be called during scanning or processing states.
   * Once complete, audit cannot be cancelled (must start new audit).
   */
  cancel(): void {
    if (this.state === 'scanning' || this.state === 'processing') {
      this.cancelled = true;
    }
  }

  /**
   * Get current audit state
   */
  getState(): AuditState {
    return this.state;
  }

  /**
   * Check if audit is currently running
   */
  isRunning(): boolean {
    return this.state !== 'idle' && this.state !== 'complete' && this.state !== 'error';
  }

  // ============================================================================
  // Private State Machine Methods
  // ============================================================================

  /**
   * Transition to new state with validation
   *
   * @param newState - Target state
   * @returns true if transition valid, false otherwise
   */
  private transition(newState: AuditState): boolean {
    const validNext = this.VALID_TRANSITIONS[this.state];

    if (!validNext.includes(newState)) {
      console.error(`Invalid audit state transition: ${this.state} → ${newState}`);
      return false;
    }

    const oldState = this.state;
    this.state = newState;

    console.log(`Audit state transition: ${oldState} → ${newState}`);

    // Emit state-specific messages
    this.emitStateMessage(newState);

    return true;
  }

  /**
   * Emit appropriate message for state entry
   *
   * @param state - Current audit state
   */
  private emitStateMessage(state: AuditState): void {
    switch (state) {
      case 'validating':
        // Validation started message already sent in STYLE_AUDIT_STARTED
        // No progress message needed for validation state
        break;

      case 'scanning':
        this.sendMessage({
          type: 'STYLE_AUDIT_PROGRESS',
          payload: {
            state: 'scanning',
            progress: 0,
            currentStep: 'Discovering text layers...',
          },
        });
        break;

      case 'processing':
        this.sendMessage({
          type: 'STYLE_AUDIT_PROGRESS',
          payload: {
            state: 'processing',
            progress: 0,
            currentStep: 'Analyzing styles and tokens...',
          },
        });
        break;

      case 'complete':
        // Complete message sent in runAudit() with results
        break;

      case 'error':
        // Error message sent in runAudit() catch block
        break;

      case 'cancelled':
        // Cancelled message sent in runAudit() catch block
        break;

      case 'idle':
        // No message needed for idle state
        break;
    }
  }

  /**
   * Send message to UI context
   *
   * @param message - Message to send
   */
  private sendMessage(message: MainToUIMessage): void {
    figma.ui.postMessage(message);
  }

  // ============================================================================
  // Audit Phase Implementations
  // ============================================================================

  /**
   * Phase 1: Validate document accessibility and size limits
   *
   * Checks document permissions, counts text layers, enforces size limits:
   * - Warning at 5,001 layers
   * - Hard limit at 25,001 layers
   *
   * @param options - Audit options
   */
  private async validateDocument(options: {
    includeHiddenLayers?: boolean;
    includeTokens?: boolean;
  }): Promise<void> {
    // Check if we can access the document
    if (!figma.currentPage) {
      throw new Error('Cannot access current page');
    }

    // Count total text layers across all pages
    let totalTextLayers = 0;
    const pages = figma.root.children;

    for (const page of pages) {
      // Load page content if needed
      await figma.loadPageAsync(page);

      // Count text nodes in this page
      const textNodes = page.findAllWithCriteria({
        types: ['TEXT'],
      });

      totalTextLayers += textNodes.length;
    }

    // Enforce size limits (from spec FR-007e/f/g)
    if (totalTextLayers > 25000) {
      throw new Error(
        `Document too large: ${totalTextLayers.toLocaleString()} text layers found. ` +
          'Maximum supported is 25,000 layers. Consider splitting into smaller documents.'
      );
    }

    if (totalTextLayers > 5000) {
      // Warning for Warning Zone (5k-25k layers)
      console.warn(
        `Large document detected: ${totalTextLayers.toLocaleString()} text layers. Performance may be impacted.`
      );

      // Could emit a warning message to UI here if needed
      // Note: STYLE_AUDIT_PROGRESS doesn't accept 'validating' state
      // This warning could be sent via a different message type if needed
    }

    console.log(
      `Document validation complete: ${totalTextLayers.toLocaleString()} text layers found`
    );
  }

  /**
   * Phase 2: Scan document and collect raw text layer data
   *
   * Traverses all pages, discovers text nodes, collects basic metadata.
   * Emits progress updates based on pages scanned.
   *
   * @returns Raw scan data for processing phase
   */
  private async scanDocument(): Promise<any> {
    const pages = figma.root.children;
    const allTextLayers: any[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      // Check for cancellation
      if (this.cancelled) {
        throw new Error('Audit cancelled during scanning');
      }

      // Load page content
      await figma.loadPageAsync(page);

      // Find all text nodes in this page
      const textNodes = page.findAllWithCriteria({
        types: ['TEXT'],
      });

      // Collect basic data for each text node
      for (const node of textNodes) {
        const textNode = node as TextNode;

        allTextLayers.push({
          id: textNode.id,
          name: textNode.name,
          characters: textNode.characters.length,
          textContent: textNode.characters.substring(0, 50), // Preview
          pageId: page.id,
          pageName: page.name,
          visible: textNode.visible,
          opacity: textNode.opacity,
          textStyleId: textNode.textStyleId,
          // Add more basic properties as needed
        });
      }

      // Emit progress update
      const progress = Math.round(((i + 1) / pages.length) * 50); // Scanning is 50% of total
      this.sendMessage({
        type: 'STYLE_AUDIT_PROGRESS',
        payload: {
          state: 'scanning',
          progress,
          currentStep: `Scanned page ${i + 1} of ${pages.length} (${textNodes.length} text layers)`,
          pagesScanned: i + 1,
        },
      });
    }

    console.log(`Document scanning complete: ${allTextLayers.length} text layers found`);

    return {
      textLayers: allTextLayers,
      totalPages: pages.length,
    };
  }

  /**
   * Phase 3: Process scan results and build complete audit result
   *
   * Extracts style metadata, resolves library information, builds hierarchy,
   * calculates metrics, and assembles final audit result.
   *
   * @param scanResult - Raw data from scanning phase
   * @param options - Audit options
   * @returns Complete StyleGovernanceAuditResult
   */
  private async processScanResults(
    scanResult: any,
    options: {
      includeHiddenLayers?: boolean;
      includeTokens?: boolean;
    }
  ): Promise<StyleGovernanceAuditResult> {
    const { textLayers, totalPages } = scanResult;

    // This is a placeholder implementation
    // In reality, this would:
    // 1. Call styleDetection.ts to get style assignments
    // 2. Call styleLibrary.ts to resolve library sources
    // 3. Call tokenDetection.ts if tokens enabled
    // 4. Call summary.ts to calculate metrics
    // 5. Build hierarchy trees

    const processedLayers = textLayers.map((layer: any, index: number) => ({
      ...layer,
      assignmentStatus: 'unstyled', // Placeholder
      tokens: [], // Placeholder
    }));

    // Emit progress updates during processing
    for (let i = 0; i <= 50; i += 10) {
      // Check for cancellation
      if (this.cancelled) {
        throw new Error('Audit cancelled during processing');
      }

      const progress = 50 + i; // Processing is remaining 50%
      this.sendMessage({
        type: 'STYLE_AUDIT_PROGRESS',
        payload: {
          state: 'processing',
          progress,
          currentStep: `Processing layer ${Math.round((i / 50) * processedLayers.length)} of ${processedLayers.length}...`,
          layersProcessed: Math.round((i / 50) * processedLayers.length),
        },
      });

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Build mock audit result (placeholder)
    const auditResult: StyleGovernanceAuditResult = {
      timestamp: new Date(),
      documentName: figma.root.name || 'Untitled',
      documentId: figma.fileKey || 'unknown',

      totalPages,
      totalTextLayers: processedLayers.length,

      styles: [], // Placeholder
      tokens: [], // Placeholder
      layers: processedLayers,
      libraries: [], // Placeholder

      styleHierarchy: [], // Placeholder
      styledLayers: [], // Placeholder
      unstyledLayers: processedLayers, // Placeholder

      metrics: {
        styleAdoptionRate: 0,
        fullyStyledCount: 0,
        partiallyStyledCount: 0,
        unstyledCount: processedLayers.length,
        libraryDistribution: {},
        tokenCoverageRate: 0,
        tokenUsageCount: 0,
        mixedUsageCount: 0,
        topStyles: [],
        deprecatedStyleCount: 0,
      },

      isStale: false,
      auditDuration: Date.now() - this.startTime,
    };

    console.log(`Document processing complete: ${processedLayers.length} layers processed`);

    return auditResult;
  }
}

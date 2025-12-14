import type { AuditState, StyleGovernanceAuditResult, MainToUIMessage } from '@/shared/types';
import { processAuditData, createAuditResult } from './processor';

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
 *
 * KEY LESSON FROM DEVELOPER_REFERENCE.md:
 * Always validate Figma API availability and handle unsupported APIs gracefully.
 * The Figma plugin environment has specific constraints:
 * - Some async APIs may not be available (e.g., figma.loadPageAsync doesn't exist)
 * - Work with figma.currentPage and figma.root instead
 * - Always check that methods exist before calling them
 */

export class AuditEngine {
  private state: AuditState = 'idle';
  private startTime: number = 0;
  private cancelled: boolean = false;

  // PERFORMANCE: Custom timing helpers (console.time not available in Figma sandbox)
  private timers: Map<string, number> = new Map();

  private startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  private endTimer(label: string): number {
    const start = this.timers.get(label);
    if (!start) return 0;
    const duration = Date.now() - start;
    console.log(`${label}: ${duration}ms`);
    this.timers.delete(label);
    return duration;
  }

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

    // PERFORMANCE: Log audit start
    console.log('━'.repeat(60));
    console.log('[Performance] Audit started');
    this.startTimer('[Performance] Total audit duration');

    try {
      // Validate Figma environment
      await this.validateFigmaEnvironment();

      // State 1: VALIDATING
      if (!this.transition('validating')) {
        throw new Error('Cannot start audit: invalid state transition');
      }

      // Send AUDIT_STARTED message to UI so it knows we're beginning the audit
      this.sendMessage({
        type: 'STYLE_AUDIT_STARTED',
        payload: { state: 'validating' },
      });

      this.startTimer('[Performance] Validation phase');
      await this.validateDocument(options);
      this.endTimer('[Performance] Validation phase');

      // State 2: SCANNING
      if (!this.transition('scanning')) {
        throw new Error('Cannot start scanning: invalid state transition');
      }

      this.startTimer('[Performance] Document scan phase');
      const scanResult = await this.scanDocument();
      this.endTimer('[Performance] Document scan phase');
      console.log(`[Performance] Scanned ${scanResult.totalTextLayers} text layers across ${scanResult.totalPages} pages`);

      // State 3: PROCESSING
      if (!this.transition('processing')) {
        throw new Error('Cannot start processing: invalid state transition');
      }

      this.startTimer('[Performance] Data processing phase');
      const auditResult = await this.processScanResults(scanResult, options);
      this.endTimer('[Performance] Data processing phase');

      // State 4: COMPLETE
      if (!this.transition('complete')) {
        throw new Error('Cannot complete audit: invalid state transition');
      }

      const duration = Date.now() - this.startTime;
      this.endTimer('[Performance] Total audit duration');
      console.log(`[Performance] Audit completed successfully in ${duration}ms`);

      // Send final result to UI
      this.sendMessage({
        type: 'STYLE_AUDIT_COMPLETE',
        payload: { result: auditResult, duration },
      });

      return auditResult;
    } catch (error) {
      // PERFORMANCE: Log error timing
      this.endTimer('[Performance] Total audit duration');
      console.error('[Performance] Audit failed:', error);
      console.log('━'.repeat(60));

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
  // Figma Environment Validation
  // ============================================================================

  /**
   * Validate that the Figma environment is properly configured
   *
   * KEY LESSON: Always validate Figma API availability before using it.
   * Some methods may not exist or may be unavailable in certain contexts.
   */
  private async validateFigmaEnvironment(): Promise<void> {
    // Check that we have figma global
    if (typeof figma === 'undefined') {
      throw new Error('Figma API not available. This plugin must run in the Figma plugin context.');
    }

    // Check that we have required figma properties
    if (!figma.currentPage) {
      throw new Error('Cannot access current page. Plugin may not have document access.');
    }

    if (!figma.root) {
      throw new Error('Cannot access document root. Plugin environment is invalid.');
    }

    // Check that figma.ui exists
    if (!figma.ui || typeof figma.ui.postMessage !== 'function') {
      throw new Error('UI message handler not available. Plugin UI context is invalid.');
    }

    console.log('✓ Figma environment validation complete');
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
   * KEY LESSON: Use figma.currentPage or figma.root instead of figma.loadPageAsync.
   * The loadPageAsync API doesn't exist in all plugin contexts.
   *
   * @param options - Audit options
   */
  private async validateDocument(_options: {
    includeHiddenLayers?: boolean;
    includeTokens?: boolean;
  }): Promise<void> {
    try {
      // Progress: 0-10% (Validation phase)
      // PERFORMANCE: Lightweight validation - DO NOT traverse document tree
      // Traversing the entire document causes OOM on large files (2GB limit)

      this.sendMessage({
        type: 'STYLE_AUDIT_PROGRESS',
        payload: {
          state: 'validating',
          progress: 2,
          currentStep: 'Checking document structure...',
        },
      });

      // Check if we can access the document
      if (!figma.currentPage) {
        throw new Error('Cannot access current page');
      }

      // Check if we can access root pages
      if (!figma.root || !figma.root.children) {
        throw new Error('Cannot access document pages');
      }

      this.sendMessage({
        type: 'STYLE_AUDIT_PROGRESS',
        payload: {
          state: 'validating',
          progress: 5,
          currentStep: 'Document ready - preparing scan...',
        },
      });

      // PERFORMANCE NOTE: We do NOT count text layers here
      // Counting requires traversing the entire document tree which causes OOM
      // Layer counts will be discovered during the actual scan phase
      const totalPages = figma.root.children.length;

      this.sendMessage({
        type: 'STYLE_AUDIT_PROGRESS',
        payload: {
          state: 'validating',
          progress: 10,
          currentStep: `Ready to scan ${totalPages} page${totalPages !== 1 ? 's' : ''}`,
        },
      });

      console.log(`✓ Document validation complete: ${totalPages} pages ready for scanning`);
    } catch (error) {
      // Re-throw validation errors
      throw error;
    }
  }

  /**
   * Find all text nodes in a page or frame
   *
   * Recursively traverses the node tree to find text nodes.
   * This is safer than using Figma's findAllWithCriteria which may not be available.
   *
   * @param node - The node to search within
   * @returns Array of text nodes
   */
  private findTextNodesInPage(node: any): any[] {
    const textNodes: any[] = [];

    if (!node) {
      return textNodes;
    }

    // Check if this node is a text node
    if (node.type === 'TEXT') {
      textNodes.push(node);
    }

    // Recursively search children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        textNodes.push(...this.findTextNodesInPage(child));
      }
    }

    return textNodes;
  }

  /**
   * Phase 2: Scan document and collect raw text layer data
   *
   * Traverses all pages, discovers text nodes, collects basic metadata.
   * Emits progress updates based on pages scanned.
   *
   * KEY LESSON: Work directly with the node tree instead of using potentially
   * unavailable APIs like figma.loadPageAsync.
   *
   * @returns Raw scan data for processing phase
   */
  private async scanDocument(): Promise<any> {
    try {
      const allTextLayers: any[] = [];
      let totalPages = 0;

      // Progress: 10-40% (Scanning phase)
      this.sendMessage({
        type: 'STYLE_AUDIT_PROGRESS',
        payload: {
          state: 'scanning',
          progress: 12,
          currentStep: 'Discovering pages...',
        },
      });

      // Scan all pages
      if (figma.root && figma.root.children) {
        totalPages = figma.root.children.length;

        this.sendMessage({
          type: 'STYLE_AUDIT_PROGRESS',
          payload: {
            state: 'scanning',
            progress: 15,
            currentStep: `Found ${totalPages} page${totalPages !== 1 ? 's' : ''} to scan`,
          },
        });

        for (let i = 0; i < figma.root.children.length; i++) {
          const page = figma.root.children[i];

          // Check for cancellation
          if (this.cancelled) {
            throw new Error('Audit cancelled during scanning');
          }

          // Progress message before scanning page
          const preProgress = 15 + Math.round((i / totalPages) * 20); // 15-35%
          this.sendMessage({
            type: 'STYLE_AUDIT_PROGRESS',
            payload: {
              state: 'scanning',
              progress: preProgress,
              currentStep: `Scanning page ${i + 1} of ${totalPages}: "${page.name}"`,
              pagesScanned: i,
            },
          });

          // Find all text nodes in this page
          const textNodes = this.findTextNodesInPage(page);

          // Collect basic data for each text node
          for (const node of textNodes) {
            try {
              // Skip empty text nodes (KEY LESSON from DEVELOPER_REFERENCE.md)
              if (node.characters && node.characters.length === 0) {
                continue;
              }

              allTextLayers.push({
                id: node.id,
                name: node.name,
                characters: node.characters ? node.characters.length : 0,
                textContent: node.characters ? node.characters.substring(0, 50) : '',
                pageId: page.id,
                pageName: page.name,
                visible: node.visible,
                opacity: node.opacity,
                textStyleId: node.textStyleId,
                // Add more basic properties as needed
              });
            } catch (nodeError) {
              // Log error but continue processing
              console.warn(`Error processing node ${node.id}:`, nodeError);
            }
          }

          // Progress message after scanning page
          const postProgress = 15 + Math.round(((i + 1) / totalPages) * 20); // 15-35%
          this.sendMessage({
            type: 'STYLE_AUDIT_PROGRESS',
            payload: {
              state: 'scanning',
              progress: postProgress,
              currentStep: `Found ${textNodes.length} text layer${textNodes.length !== 1 ? 's' : ''} on "${page.name}"`,
              pagesScanned: i + 1,
            },
          });
        }

        // Building metadata step
        this.sendMessage({
          type: 'STYLE_AUDIT_PROGRESS',
          payload: {
            state: 'scanning',
            progress: 37,
            currentStep: 'Building component hierarchy...',
          },
        });

      } else {
        // Fallback: just scan current page
        this.sendMessage({
          type: 'STYLE_AUDIT_PROGRESS',
          payload: {
            state: 'scanning',
            progress: 20,
            currentStep: 'Scanning current page...',
          },
        });

        const textNodes = this.findTextNodesInPage(figma.currentPage);

        for (const node of textNodes) {
          try {
            // Skip empty text nodes
            if (node.characters && node.characters.length === 0) {
              continue;
            }

            allTextLayers.push({
              id: node.id,
              name: node.name,
              characters: node.characters ? node.characters.length : 0,
              textContent: node.characters ? node.characters.substring(0, 50) : '',
              pageId: figma.currentPage.id,
              pageName: figma.currentPage.name,
              visible: node.visible,
              opacity: node.opacity,
              textStyleId: node.textStyleId,
            });
          } catch (nodeError) {
            console.warn(`Error processing node ${node.id}:`, nodeError);
          }
        }

        totalPages = 1;
      }

      this.sendMessage({
        type: 'STYLE_AUDIT_PROGRESS',
        payload: {
          state: 'scanning',
          progress: 40,
          currentStep: `Scan complete: ${allTextLayers.length} text layer${allTextLayers.length !== 1 ? 's' : ''} collected`,
        },
      });

      console.log(`Document scanning complete: ${allTextLayers.length} text layers found`);

      return {
        textLayers: allTextLayers,
        totalPages,
      };
    } catch (error) {
      throw error;
    }
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

    try {
      // Process audit data using the processor
      // Pass callbacks for cancellation and progress reporting
      const processed = await processAuditData(
        {
          textLayers,
          totalPages,
          options,
        },
        () => this.cancelled,
        (progress: number, message: string) => {
          // Forward progress updates to UI
          this.sendMessage({
            type: 'STYLE_AUDIT_PROGRESS',
            payload: {
              state: 'processing',
              progress,
              currentStep: message,
            },
          });
        }
      );

      // Emit final progress update
      this.sendMessage({
        type: 'STYLE_AUDIT_PROGRESS',
        payload: {
          state: 'processing',
          progress: 100,
          currentStep: `Processing complete: ${processed.layers.length} layers processed`,
          layersProcessed: processed.layers.length,
        },
      });

      // Build audit result
      const auditResult = createAuditResult(
        processed,
        {
          documentName: figma.root ? figma.root.name : figma.currentPage.name || 'Untitled',
          documentId: figma.fileKey || 'unknown',
          totalPages,
        },
        Date.now() - this.startTime
      );

      return auditResult;
    } catch (error) {
      throw error;
    }
  }
}

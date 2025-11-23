import type { UIToMainMessage, MainToUIMessage, AuditResult, TextLayerData } from '@/shared/types';
import { getTextNodesFromScope } from './utils/traversal';
import { extractFontMetadata } from './utils/fontMetadata';
import { detectStyleAssignment } from './utils/styleDetection';
import { calculateSummary } from './utils/summary';
import { AuditEngine } from './audit/auditEngine';
import { ReplacementEngine } from './replacement/replacementEngine';

// ============================================================================
// Main Entry Point (Figma Sandbox Context)
// ============================================================================

// ============================================================================
// Plugin Initialization
// ============================================================================

// The __html__ variable will be injected at build time with the compiled UI HTML
declare const __html__: string;

// Show the plugin UI
figma.showUI(__html__, {
  width: 400,
  height: 600,
});

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handle messages from the UI context
 *
 * Routes messages to appropriate handlers:
 * - Legacy font audit (RUN_AUDIT, CANCEL_AUDIT)
 * - Style governance audit (RUN_STYLE_AUDIT, CANCEL_STYLE_AUDIT)
 * - Replacement operations (REPLACE_STYLE, REPLACE_TOKEN, ROLLBACK_TO_CHECKPOINT)
 * - Export operations (EXPORT_PDF)
 * - Navigation (NAVIGATE_TO_LAYER)
 */
figma.ui.onmessage = async (msg: UIToMainMessage) => {
  try {
    switch (msg.type) {
      // ==================================================================
      // Legacy Font Audit (Feature 001)
      // ==================================================================
      case 'RUN_AUDIT':
        await handleRunAudit(msg.scope);
        break;

      case 'CANCEL_AUDIT':
        handleCancelAudit();
        break;

      // ==================================================================
      // Style Governance Audit (Feature 002)
      // ==================================================================
      case 'RUN_STYLE_AUDIT':
        await handleRunStyleAudit(msg.payload);
        break;

      case 'CANCEL_STYLE_AUDIT':
        handleCancelStyleAudit();
        break;

      // ==================================================================
      // Replacement Operations
      // ==================================================================
      case 'REPLACE_STYLE':
        await handleReplaceStyle(
          msg.payload.sourceStyleId,
          msg.payload.targetStyleId,
          msg.payload.affectedLayerIds
        );
        break;

      case 'REPLACE_TOKEN':
        await handleReplaceToken(msg.payload.sourceTokenId, msg.payload.targetTokenId);
        break;

      // case 'ROLLBACK_TO_CHECKPOINT':
      //   await handleRollbackToCheckpoint(msg.payload.checkpointId);
      //   break;

      // ==================================================================
      // Export Operations
      // ==================================================================
      case 'EXPORT_PDF':
        await handleExportPDF(msg.payload.auditResult);
        break;

      // ==================================================================
      // Navigation
      // ==================================================================
      case 'NAVIGATE_TO_LAYER':
        await handleNavigateToLayer(msg.layerId);
        break;

      default:
        console.warn('Unknown message type:', (msg as { type: string }).type);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    sendMessage({
      type: 'AUDIT_ERROR',
      error: errorMessage,
      errorType: 'UNKNOWN',
    });
  }
};

// ============================================================================
// Message Sending Helper
// ============================================================================

/**
 * Send a message to the UI context
 */
function sendMessage(message: MainToUIMessage): void {
  figma.ui.postMessage(message);
}

// ============================================================================
// Audit Handler
// ============================================================================

let cancelFlag = false;

/**
 * Handle RUN_AUDIT message - main audit orchestration
 */
async function handleRunAudit(scope: 'page' | 'selection'): Promise<void> {
  try {
    cancelFlag = false;

    sendMessage({ type: 'AUDIT_STARTED' });

    // Step 1: Get text nodes from scope
    const { textNodes } = await getTextNodesFromScope(scope, () => cancelFlag);

    if (textNodes.length === 0) {
      throw new Error('No text layers found in the selected scope');
    }

    // Step 2: Process each text node
    const textLayers: TextLayerData[] = [];
    const total = textNodes.length;

    for (let i = 0; i < textNodes.length; i++) {
      // Check for cancellation
      if (cancelFlag) {
        throw new Error('Audit cancelled by user');
      }

      const node = textNodes[i];

      // Skip empty text nodes silently
      if (node.characters.length === 0) {
        continue;
      }

      try {
        // Extract font metadata
        const metadata = await extractFontMetadata(node);

        // Detect style assignment
        const styleAssignment = await detectStyleAssignment(node);

        // Combine into complete TextLayerData
        const textLayer: TextLayerData = {
          ...metadata,
          styleAssignment,
          // matchSuggestions will be added in Phase 6 (User Story 3)
        };

        textLayers.push(textLayer);

        // Report progress
        const progress = Math.round(((i + 1) / total) * 100);
        sendMessage({
          type: 'AUDIT_PROGRESS',
          progress,
          current: i + 1,
          total,
        });
      } catch (error) {
        // Log error but continue processing other nodes
        console.error(`Error processing node ${node.id}:`, error);
      }
    }

    // Step 3: Calculate summary
    const summary = calculateSummary(textLayers);

    // Step 4: Build result
    const result: AuditResult = {
      textLayers,
      summary,
      timestamp: new Date().toISOString(),
      fileName: figma.root.name,
    };

    // Step 5: Send completion message
    sendMessage({
      type: 'AUDIT_COMPLETE',
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Audit failed';
    const errorType = errorMessage.includes('No text layers') ? 'VALIDATION' : 'UNKNOWN';

    sendMessage({
      type: 'AUDIT_ERROR',
      error: errorMessage,
      errorType,
    });
  }
}

// ============================================================================
// Navigation Handler
// ============================================================================

/**
 * Handle NAVIGATE_TO_LAYER message - focus a layer in Figma
 */
async function handleNavigateToLayer(layerId: string): Promise<void> {
  try {
    const node = await figma.getNodeByIdAsync(layerId);

    if (!node) {
      throw new Error('Layer not found');
    }

    if (node.type !== 'TEXT') {
      throw new Error('Layer is not a text layer');
    }

    // Focus the layer
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);

    sendMessage({ type: 'NAVIGATE_SUCCESS' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Navigation failed';
    sendMessage({
      type: 'NAVIGATE_ERROR',
      error: errorMessage,
    });
  }
}

// ============================================================================
// Cancel Handler
// ============================================================================

/**
 * Handle CANCEL_AUDIT message - stop the current audit
 */
function handleCancelAudit(): void {
  cancelFlag = true;
  sendMessage({
    type: 'AUDIT_ERROR',
    error: 'Audit cancelled by user',
    errorType: 'UNKNOWN',
  });
}

// ============================================================================
// Style Governance Audit Handlers (Feature 002 - Phase 2)
// ============================================================================

/**
 * Handle RUN_STYLE_AUDIT message
 * Implements the new style governance audit using AuditEngine
 */
async function handleRunStyleAudit(payload?: {
  includeHiddenLayers?: boolean;
  includeTokens?: boolean;
}): Promise<void> {
  try {
    console.log('[StyleAudit] Starting audit with options:', payload);

    // Send initial message to UI to start state machine
    figma.ui.postMessage({
      type: 'STYLE_AUDIT_STARTED',
      payload: {
        state: 'validating',
      },
    });

    // Create audit engine instance
    const auditEngine = new AuditEngine();

    // Run the audit
    await auditEngine.runAudit(payload || {});

    console.log('[StyleAudit] Audit completed successfully');
  } catch (error) {
    console.error('[StyleAudit] Audit failed:', error);

    // Error will be handled by AuditEngine and sent via message handler
    // No need to send additional error message here
  }
}

/**
 * Handle CANCEL_STYLE_AUDIT message
 * PLACEHOLDER: Will be implemented in Phase 2
 */
function handleCancelStyleAudit(): void {
  console.log('[StyleAudit] Cancel placeholder called');
  sendMessage({
    type: 'STYLE_AUDIT_CANCELLED',
    payload: {},
  });
}

// ============================================================================
// Replacement Operation Handlers (Feature 002 - Phase 3)
// ============================================================================

/**
 * Handle REPLACE_STYLE message
 */
async function handleReplaceStyle(
  sourceStyleId: string,
  targetStyleId: string,
  affectedLayerIds: string[]
): Promise<void> {
  console.log('[Replacement] Starting style replacement:', {
    sourceStyleId,
    targetStyleId,
    affectedLayerCount: affectedLayerIds.length,
  });

  try {
    const engine = new ReplacementEngine();

    // Setup progress callbacks
    engine.onProgress((progress) => {
      if (progress.state === 'processing') {
        sendMessage({
          type: 'REPLACEMENT_PROGRESS',
          payload: {
            state: 'processing',
            progress: progress.percentage,
            currentBatch: progress.currentBatch,
            totalBatches: progress.totalBatches,
            currentBatchSize: progress.currentBatchSize,
            layersProcessed: progress.layersProcessed,
            failedLayers: progress.failedLayers,
          },
        });
      } else if (progress.state === 'creating_checkpoint' && progress.checkpointTitle) {
        sendMessage({
          type: 'REPLACEMENT_CHECKPOINT_CREATED',
          payload: {
            checkpointTitle: progress.checkpointTitle,
            timestamp: new Date(),
          },
        });
      }
    });

    // Send start message
    sendMessage({
      type: 'REPLACEMENT_STARTED',
      payload: {
        operationType: 'style',
        state: 'validating',
        sourceId: sourceStyleId,
        targetId: targetStyleId,
        affectedLayerCount: affectedLayerIds.length,
      },
    });

    // Execute replacement
    const result = await engine.replaceStyle({
      sourceStyleId,
      targetStyleId,
      affectedLayerIds,
      preserveOverrides: true,
    });

    // Send completion message
    sendMessage({
      type: 'REPLACEMENT_COMPLETE',
      payload: {
        operationType: 'style',
        layersUpdated: result.layersUpdated,
        failedLayers: result.failedLayers,
        duration: result.duration,
        hasWarnings: result.hasWarnings,
      },
    });

    // Clean up
    engine.dispose();

    console.log('[Replacement] Style replacement complete:', {
      updated: result.layersUpdated,
      failed: result.layersFailed,
      checkpoint: result.checkpointTitle,
    });
  } catch (error) {
    console.error('[Replacement] Style replacement failed:', error);
    sendMessage({
      type: 'REPLACEMENT_ERROR',
      payload: {
        operationType: 'style',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'processing',
        checkpointTitle: undefined,
        canRollback: true,
      },
    });
  }
}

/**
 * Handle REPLACE_TOKEN message
 * PLACEHOLDER: Will be implemented in Phase 3
 */
async function handleReplaceToken(sourceTokenId: string, targetTokenId: string): Promise<void> {
  console.log('[Replacement] Replace token placeholder:', {
    sourceTokenId,
    targetTokenId,
  });
  sendMessage({
    type: 'REPLACEMENT_ERROR',
    payload: {
      operationType: 'token',
      error: 'Token replacement not yet implemented (Phase 3)',
      errorType: 'validation',
      canRollback: false,
    },
  });
}

/**
 * Handle ROLLBACK_TO_CHECKPOINT message
 * PLACEHOLDER: Will be implemented in Phase 5
 * Currently commented out - route not yet active
 */
// async function handleRollbackToCheckpoint(checkpointId: string): Promise<void> {
//   console.log('[Replacement] Rollback placeholder:', checkpointId);
//   // Note: Rollback uses version history API, not custom implementation
//   figma.notify('Rollback not yet implemented (Phase 5)', { error: true });
// }

// ============================================================================
// Export Handler (Feature 002 - Phase 4)
// ============================================================================

/**
 * Handle EXPORT_PDF message
 * PLACEHOLDER: Will be implemented in Phase 7 (Export)
 */
async function handleExportPDF(_auditResult: any): Promise<void> {
  console.log('[Export] PDF export placeholder called');
  sendMessage({
    type: 'EXPORT_ERROR',
    payload: {
      exportType: 'pdf',
      error: 'PDF export not yet implemented (Phase 4)',
    },
  });
}

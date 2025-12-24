import type { UIToMainMessage, MainToUIMessage, AuditResult, TextLayerData } from '@/shared/types';
import { getTextNodesFromScope } from './utils/traversal';
import { extractFontMetadata } from './utils/fontMetadata';
import { detectStyleAssignment } from './utils/styleDetection';
import { calculateSummary } from './utils/summary';
import { AuditEngine } from './audit/auditEngine';
import { ReplacementEngine } from './replacement/replacementEngine';
import { convertStylesToLocal } from './conversion/conversionEngine';

// ============================================================================
// Main Entry Point (Figma Sandbox Context)
// ============================================================================

// ============================================================================
// State Management
// ============================================================================

// Track current replacement engine for cancellation
let currentReplacementEngine: ReplacementEngine | null = null;

// ============================================================================
// Plugin Initialization
// ============================================================================

// The __html__ variable will be injected at build time with the compiled UI HTML
declare const __html__: string;

// Show the plugin UI
// Calculate responsive plugin window size based on viewport
// Using figma.ui.resize() allows dynamic sizing after showing UI
const calculatePluginSize = () => {
  // Figma plugin window constraints (in pixels)
  const maxWidth = 1200;
  const defaultHeight = 800;

  // The plugin window will constrain itself to available space
  // but we set it to maxWidth which provides optimal experience
  return { width: maxWidth, height: defaultHeight };
};

const pluginSize = calculatePluginSize();

console.log('🚀 [TYPESCOPE] Plugin loaded successfully');

figma.showUI(__html__, {
  width: pluginSize.width,
  height: pluginSize.height,
  themeColors: true,
  // Note: Figma plugin windows are NOT resizable via the API
  // The window size is fixed at initialization (1200x800)
  // Users can programmatically resize via figma.ui.resize() if needed
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
        await handleReplaceToken(
          msg.payload.sourceTokenId,
          msg.payload.targetTokenId,
          msg.payload.affectedLayerIds
        );
        break;

      case 'CANCEL_REPLACEMENT':
        handleCancelReplacement();
        break;

      // ==================================================================
      // Conversion Operations
      // ==================================================================
      case 'CONVERT_TO_LOCAL_STYLES':
        await handleConvertToLocalStyles(msg.payload.sourceStyleIds, msg.payload.propertyOverrides);
        break;

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

      // ==================================================================
      // UI Preferences
      // ==================================================================
      case 'GET_GROUP_BY_LIBRARY':
        handleGetGroupByLibrary();
        break;

      case 'SAVE_GROUP_BY_LIBRARY':
        await handleSaveGroupByLibrary(msg.payload.enabled);
        break;

      // ==================================================================
      // Page Selection
      // ==================================================================
      case 'GET_PAGES':
        handleGetPages();
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
      tokenInventory: [],
      tokenUsageCount: 0,
      tokenAdoptionRate: 0,
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
 * Validate layer ID format to prevent injection attacks
 * Figma layer IDs are in format: "123:456" (digits colon digits)
 *
 * @param layerId - The layer ID to validate
 * @returns true if valid, false otherwise
 */
function isValidLayerId(layerId: unknown): layerId is string {
  if (typeof layerId !== 'string') {
    return false;
  }

  // Figma layer IDs follow pattern: digits:digits or single number
  // Examples: "123:456", "789", "1:2:3"
  // Max length: 256 characters (reasonable limit)
  if (layerId.length === 0 || layerId.length > 256) {
    return false;
  }

  // Only allow digits and colons
  return /^[\d:]+$/.test(layerId);
}

/**
 * Handle NAVIGATE_TO_LAYER message - focus a layer in Figma
 */
async function handleNavigateToLayer(layerId: string): Promise<void> {
  try {
    // Validate layer ID format to prevent injection attacks
    if (!isValidLayerId(layerId)) {
      throw new Error('Invalid layer ID format');
    }

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
// Page Selection Handler
// ============================================================================

/**
 * Handle GET_PAGES message - return list of all pages in document
 */
function handleGetPages(): void {
  try {
    const pages = figma.root.children.map((page: any) => ({
      id: page.id,
      name: page.name,
    }));

    sendMessage({
      type: 'PAGES_LIST',
      payload: { pages },
    });
  } catch (error) {
    console.error('[handleGetPages] Error fetching pages:', error);
    // Send empty list on error
    sendMessage({
      type: 'PAGES_LIST',
      payload: { pages: [] },
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

    // PERFORMANCE: Enable flag to skip invisible instance children
    // This can be hundreds of times faster for large documents
    figma.skipInvisibleInstanceChildren = true;

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
  } finally {
    // Reset flag after audit
    figma.skipInvisibleInstanceChildren = false;
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
    currentReplacementEngine = engine;

    // Throttle progress updates to avoid UI blocking (max one update per 150ms)
    let lastProgressUpdate = 0;
    const PROGRESS_THROTTLE_MS = 150;

    // Setup progress callbacks
    engine.onProgress((progress) => {
      if (progress.state === 'processing') {
        const now = Date.now();
        // Only send progress updates if enough time has passed or if we're at 100%
        if (now - lastProgressUpdate >= PROGRESS_THROTTLE_MS || progress.percentage === 100) {
          lastProgressUpdate = now;
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
        }
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
    currentReplacementEngine = null;

    console.log('[Replacement] Style replacement complete:', {
      updated: result.layersUpdated,
      failed: result.layersFailed,
      checkpoint: result.checkpointTitle,
    });
  } catch (error) {
    console.error('[Replacement] Style replacement failed:', error);

    // Check if this was a cancellation
    if (error instanceof Error && error.message === 'Replacement cancelled by user') {
      sendMessage({
        type: 'REPLACEMENT_CANCELLED',
        payload: {
          operationType: 'style',
          layersProcessed: 0, // TODO: track actual progress
        },
      });
    } else {
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

    currentReplacementEngine = null;
  }
}

/**
 * Handle REPLACE_TOKEN message
 */
async function handleReplaceToken(
  sourceTokenId: string,
  targetTokenId: string,
  affectedLayerIds: string[]
): Promise<void> {
  console.log('[Replacement] Starting token replacement:', {
    sourceTokenId,
    targetTokenId,
    affectedLayerCount: affectedLayerIds.length,
  });

  try {
    const engine = new ReplacementEngine();
    currentReplacementEngine = engine;

    // Throttle progress updates to avoid UI blocking (max one update per 150ms)
    let lastProgressUpdate = 0;
    const PROGRESS_THROTTLE_MS = 150;

    // Setup progress callbacks
    engine.onProgress((progress) => {
      if (progress.state === 'processing') {
        const now = Date.now();
        // Only send progress updates if enough time has passed or if we're at 100%
        if (now - lastProgressUpdate >= PROGRESS_THROTTLE_MS || progress.percentage === 100) {
          lastProgressUpdate = now;
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
        }
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
        operationType: 'token',
        state: 'validating',
        sourceId: sourceTokenId,
        targetId: targetTokenId,
        affectedLayerCount: affectedLayerIds.length,
      },
    });

    // Execute replacement
    const result = await engine.replaceToken({
      sourceTokenId,
      targetTokenId,
      affectedLayerIds,
    });

    // Send completion message
    sendMessage({
      type: 'REPLACEMENT_COMPLETE',
      payload: {
        operationType: 'token',
        layersUpdated: result.layersUpdated,
        failedLayers: result.failedLayers || [],
        duration: result.duration,
        hasWarnings: result.hasWarnings,
      },
    });

    // Cleanup
    engine.dispose();
    currentReplacementEngine = null;
  } catch (error) {
    console.error('[Replacement] Token replacement error:', error);

    // Check if this was a cancellation
    if (error instanceof Error && error.message === 'Replacement cancelled by user') {
      sendMessage({
        type: 'REPLACEMENT_CANCELLED',
        payload: {
          operationType: 'token',
          layersProcessed: 0, // TODO: track actual progress
        },
      });
    } else {
      sendMessage({
        type: 'REPLACEMENT_ERROR',
        payload: {
          operationType: 'token',
          error: error instanceof Error ? error.message : String(error),
          errorType: 'processing',
          canRollback: true,
        },
      });
    }

    currentReplacementEngine = null;
  }
}

/**
 * Handle CANCEL_REPLACEMENT message
 */
function handleCancelReplacement(): void {
  console.log('[Replacement] Cancel requested');

  if (currentReplacementEngine) {
    currentReplacementEngine.cancel();
    console.log('[Replacement] Cancellation flag set');
  } else {
    console.warn('[Replacement] No active replacement to cancel');
  }
}

// ============================================================================
// Conversion Handler
// ============================================================================

/**
 * Handle CONVERT_TO_LOCAL_STYLES message
 * Converts remote text styles to local styles with optional property overrides
 */
async function handleConvertToLocalStyles(
  sourceStyleIds: string[],
  propertyOverrides: any
): Promise<void> {
  console.log('[Conversion] Starting conversion:', {
    sourceStyleIds,
    propertyOverrides,
    styleCount: sourceStyleIds.length,
  });

  try {
    const result = await convertStylesToLocal({ sourceStyleIds, propertyOverrides });

    console.log('[Conversion] Conversion complete:', {
      totalConverted: result.totalConverted,
      totalFailed: result.totalFailed,
      duration: result.duration,
    });

    sendMessage({
      type: 'CONVERSION_COMPLETE',
      payload: result,
    });

    // Show success notification
    const message =
      result.totalFailed > 0
        ? `Converted ${result.totalConverted} style(s). ${result.totalFailed} failed.`
        : `Converted ${result.totalConverted} style(s) successfully`;
    figma.notify(message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Conversion] Error:', errorMessage);

    sendMessage({
      type: 'CONVERSION_ERROR',
      payload: {
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
    });

    figma.notify(`Conversion failed: ${errorMessage}`, { error: true });
  }
}

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

// ============================================================================
// UI Preference Handlers
// ============================================================================

/**
 * Handle GET_GROUP_BY_LIBRARY message - load groupByLibrary preference
 */
function handleGetGroupByLibrary(): void {
  figma.clientStorage
    .getAsync('groupByLibrary')
    .then((value: boolean | undefined) => {
      // Default to true if not set
      const groupByLibrary = value !== undefined ? value : true;
      sendMessage({
        type: 'GROUP_BY_LIBRARY_LOADED',
        payload: { enabled: groupByLibrary },
      });
    })
    .catch((error: unknown) => {
      console.error('[Preferences] Failed to load groupByLibrary:', error);
      // Send default value on error
      sendMessage({
        type: 'GROUP_BY_LIBRARY_LOADED',
        payload: { enabled: true },
      });
    });
}

/**
 * Handle SAVE_GROUP_BY_LIBRARY message - save groupByLibrary preference
 */
async function handleSaveGroupByLibrary(enabled: boolean): Promise<void> {
  try {
    await figma.clientStorage.setAsync('groupByLibrary', enabled);
    sendMessage({
      type: 'GROUP_BY_LIBRARY_SAVED',
      payload: { success: true },
    });
  } catch (error: unknown) {
    console.error('[Preferences] Failed to save groupByLibrary:', error);
    sendMessage({
      type: 'GROUP_BY_LIBRARY_SAVED',
      payload: { success: false },
    });
  }
}

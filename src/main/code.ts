import type { UIToMainMessage, MainToUIMessage, AuditResult } from '@/shared/types';

// ============================================================================
// Main Entry Point (Figma Sandbox Context)
// ============================================================================

/**
 * Shows the plugin UI when the plugin is run
 */
figma.showUI(__html__, {
  width: 400,
  height: 600,
  themeColors: true,
});

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handle messages from the UI context
 */
figma.ui.onmessage = async (msg: UIToMainMessage) => {
  try {
    switch (msg.type) {
      case 'RUN_AUDIT':
        await handleRunAudit(msg.scope);
        break;

      case 'NAVIGATE_TO_LAYER':
        await handleNavigateToLayer(msg.layerId);
        break;

      case 'CANCEL_AUDIT':
        handleCancelAudit();
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
  cancelFlag = false;

  sendMessage({ type: 'AUDIT_STARTED' });

  // TODO: Implement audit logic in Phase 3 (User Story 1)
  // This is a skeleton for Phase 2 - will be implemented in T027-T029

  // Placeholder for demonstration
  const result: AuditResult = {
    textLayers: [],
    summary: {
      totalTextLayers: 0,
      uniqueFontFamilies: 0,
      styleCoveragePercent: 0,
      librariesInUse: [],
      potentialMatchesCount: 0,
      hiddenLayersCount: 0,
    },
    timestamp: new Date().toISOString(),
    fileName: figma.root.name,
  };

  sendMessage({
    type: 'AUDIT_COMPLETE',
    result,
  });
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

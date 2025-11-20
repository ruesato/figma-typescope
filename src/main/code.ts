import type {
  UIToMainMessage,
  MainToUIMessage,
  AuditResult,
  TextLayerData,
} from '@/shared/types';
import { getTextNodesFromScope } from './utils/traversal';
import { extractFontMetadata } from './utils/fontMetadata';
import { detectStyleAssignment } from './utils/styleDetection';
import { calculateSummary } from './utils/summary';

// ============================================================================
// Main Entry Point (Figma Sandbox Context)
// ============================================================================

// ============================================================================
// Plugin Initialization
// ============================================================================

// The __html__ variable will be injected at build time with the compiled UI HTML
// @ts-ignore - __html__ is defined at build time
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
    try {
      cancelFlag = false;

      sendMessage({ type: 'AUDIT_STARTED' });

      // Step 1: Get text nodes from scope
      const { textNodes, scopeName } = await getTextNodesFromScope(
        scope,
        () => cancelFlag
      );

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
      const errorType = errorMessage.includes('No text layers')
        ? ('VALIDATION' as const)
        : ('UNKNOWN' as const);

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

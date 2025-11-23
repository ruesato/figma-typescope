import { useEffect } from 'react';
import type { MainToUIMessage, UIToMainMessage } from '@/shared/types';
import { useAuditState } from './useAuditState';
import { useReplacementState } from './useReplacementState';

/**
 * Hook for handling postMessage communication with the main context
 *
 * Supports both legacy font audit messages (AUDIT_*) and new style governance
 * messages (STYLE_AUDIT_*, REPLACEMENT_*, EXPORT_*).
 */
export function useMessageHandler() {
  const auditState = useAuditState();
  const replacementState = useReplacementState();

  // Listen for messages from main context
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Figma wraps plugin messages in event.data.pluginMessage
      const msg = event.data.pluginMessage as MainToUIMessage;

      // Ignore non-plugin messages
      if (!msg || !msg.type) {
        return;
      }

      switch (msg.type) {
        // ====================================================================
        // Legacy Font Audit Messages (Feature 001)
        // ====================================================================
        case 'AUDIT_STARTED':
          // Legacy: Use old setter methods for backward compatibility
          auditState.transitionTo('validating');
          auditState.setProgress(0);
          break;

        case 'AUDIT_PROGRESS':
          auditState.setProgress(msg.progress);
          break;

        case 'AUDIT_COMPLETE':
          // Note: Legacy audit stores in `auditResult`, not `styleGovernanceResult`
          auditState.transitionTo('complete');
          auditState.setProgress(100);
          break;

        case 'AUDIT_ERROR':
          auditState.transitionTo('error');
          console.error(`Audit error (${msg.errorType}):`, msg.error);
          break;

        // ====================================================================
        // Style Governance Audit Messages (Feature 002)
        // ====================================================================
        case 'STYLE_AUDIT_STARTED':
          auditState.transitionTo(msg.payload.state);
          auditState.setProgress(0);
          break;

        case 'STYLE_AUDIT_PROGRESS':
          // Transition state if it has changed (e.g., from scanning to processing)
          if (msg.payload.state) {
            auditState.transitionTo(msg.payload.state);
          }
          auditState.setProgress(msg.payload.progress, msg.payload.currentStep);
          break;

        case 'STYLE_AUDIT_COMPLETE':
          auditState.transitionTo('complete');
          auditState.setStyleGovernanceResult(msg.payload.result);
          auditState.setProgress(100);
          break;

        case 'STYLE_AUDIT_ERROR':
          auditState.transitionTo('error');
          console.error('[StyleAudit] Error:', msg.payload.error);
          break;

        case 'STYLE_AUDIT_CANCELLED':
          auditState.transitionTo('cancelled');
          console.log('[StyleAudit] Cancelled by user');
          break;

        case 'STYLE_AUDIT_INVALIDATED':
          auditState.invalidate();
          console.log('[StyleAudit] Results invalidated:', msg.payload.reason);
          break;

        // ====================================================================
        // Replacement Operation Messages
        // ====================================================================
        case 'REPLACEMENT_STARTED':
          replacementState.transitionTo(msg.payload.state);
          console.log(`[Replacement] Started: ${msg.payload.operationType}`);
          break;

        case 'REPLACEMENT_CHECKPOINT_CREATED':
          replacementState.transitionTo('processing');
          console.log('[Replacement] Checkpoint created:', msg.payload.checkpointTitle);
          break;

        case 'REPLACEMENT_PROGRESS':
          replacementState.transitionTo('processing');
          replacementState.setProgress(msg.payload.progress);
          if (msg.payload.batchInfo) {
            replacementState.setBatchInfo(
              msg.payload.batchInfo.currentBatch,
              msg.payload.batchInfo.totalBatches,
              msg.payload.batchInfo.currentBatchSize
            );
          }
          break;

        case 'REPLACEMENT_COMPLETE':
          replacementState.transitionTo('complete');
          console.log('[Replacement] Complete:', msg.payload.result);
          break;

        case 'REPLACEMENT_ERROR':
          replacementState.transitionTo('error');
          console.error('[Replacement] Error:', msg.payload.error);
          break;

        // ====================================================================
        // Export Messages
        // ====================================================================
        case 'EXPORT_PDF_STARTED':
          console.log('[Export] PDF generation started');
          break;

        case 'EXPORT_PDF_COMPLETE':
          console.log('[Export] PDF saved to:', msg.payload.filePath);
          break;

        case 'EXPORT_PDF_ERROR':
          console.error('[Export] PDF error:', msg.payload.error);
          break;

        // ====================================================================
        // Navigation Messages
        // ====================================================================
        case 'NAVIGATE_SUCCESS':
          console.log('[Navigation] Success');
          break;

        case 'NAVIGATE_ERROR':
          console.error('[Navigation] Error:', msg.error);
          break;

        default:
          console.warn('Unknown message type:', (msg as { type: string }).type);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [auditState, replacementState]);

  // ======================================================================
  // Message Sending Helpers
  // ======================================================================

  const sendMessage = (message: UIToMainMessage) => {
    parent.postMessage({ pluginMessage: message }, '*');
  };

  // ======================================================================
  // Legacy Font Audit Helpers (Feature 001)
  // ======================================================================

  const runAudit = (scope: 'page' | 'selection') => {
    sendMessage({ type: 'RUN_AUDIT', scope });
  };

  const cancelAudit = () => {
    sendMessage({ type: 'CANCEL_AUDIT' });
  };

  // ======================================================================
  // Style Governance Audit Helpers (Feature 002)
  // ======================================================================

  const runStyleAudit = (options?: { includeHiddenLayers?: boolean; includeTokens?: boolean }) => {
    sendMessage({
      type: 'RUN_STYLE_AUDIT',
      payload: options,
    });
  };

  const cancelStyleAudit = () => {
    sendMessage({ type: 'CANCEL_STYLE_AUDIT' });
  };

  // ======================================================================
  // Replacement Operation Helpers
  // ======================================================================

  const replaceStyle = (
    sourceStyleId: string,
    targetStyleId: string,
    affectedLayerIds: string[]
  ) => {
    sendMessage({
      type: 'REPLACE_STYLE',
      payload: {
        sourceStyleId,
        targetStyleId,
        affectedLayerIds,
      },
    });
  };

  const replaceToken = (
    sourceTokenId: string,
    targetTokenId: string,
    affectedLayerIds: string[]
  ) => {
    sendMessage({
      type: 'REPLACE_TOKEN',
      payload: {
        sourceTokenId,
        targetTokenId,
        affectedLayerIds,
      },
    });
  };

  const rollbackToCheckpoint = (checkpointId: string) => {
    sendMessage({
      type: 'ROLLBACK_TO_CHECKPOINT',
      payload: {
        checkpointId,
      },
    });
  };

  // ======================================================================
  // Export Helpers
  // ======================================================================

  const exportPDF = (auditResult: any) => {
    sendMessage({
      type: 'EXPORT_PDF',
      payload: {
        auditResult,
      },
    });
  };

  // ======================================================================
  // Navigation Helpers
  // ======================================================================

  const navigateToLayer = (layerId: string) => {
    sendMessage({ type: 'NAVIGATE_TO_LAYER', layerId });
  };

  // ======================================================================
  // Return Public API
  // ======================================================================

  return {
    // Legacy font audit (Feature 001)
    runAudit,
    cancelAudit,

    // Style governance audit (Feature 002)
    runStyleAudit,
    cancelStyleAudit,

    // Replacement operations
    replaceStyle,
    replaceToken,
    rollbackToCheckpoint,

    // Export
    exportPDF,

    // Navigation
    navigateToLayer,
  };
}

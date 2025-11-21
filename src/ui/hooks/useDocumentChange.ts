import { useEffect } from 'react';
import { useAuditState } from './useAuditState';

/**
 * Document change detection hook
 *
 * Listens for STYLE_AUDIT_INVALIDATED messages from main context
 * and marks audit results as stale when document modifications are detected.
 *
 * Based on research.md R1: Uses documentchange event in main context,
 * which sends invalidation messages to UI.
 */
export function useDocumentChange() {
  const auditState = useAuditState();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data.pluginMessage;

      if (message?.type === 'STYLE_AUDIT_INVALIDATED') {
        // Mark current audit results as stale
        auditState.invalidate();

        // Log the reason for debugging
        console.log('[DocumentChange] Audit invalidated:', message.payload.reason);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [auditState]);

  return {
    isStale: auditState.isStale,
  };
}

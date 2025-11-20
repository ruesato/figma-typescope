import { useEffect } from 'react';
import type { MainToUIMessage, UIToMainMessage } from '@/shared/types';
import { useAuditState } from './useAuditState';

/**
 * Hook for handling postMessage communication with the main context
 */
export function useMessageHandler() {
  const { setAuditResult, setIsAuditing, setProgress, setError } = useAuditState();

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
        case 'AUDIT_STARTED':
          setIsAuditing(true);
          setProgress(0);
          setError(null);
          break;

        case 'AUDIT_PROGRESS':
          setProgress(msg.progress);
          break;

        case 'AUDIT_COMPLETE':
          setAuditResult(msg.result);
          setIsAuditing(false);
          setProgress(100);
          break;

        case 'AUDIT_ERROR':
          setError(msg.error);
          setIsAuditing(false);
          console.error(`Audit error (${msg.errorType}):`, msg.error);
          break;

        case 'NAVIGATE_SUCCESS':
          // Optional: Show success toast
          console.log('Navigation successful');
          break;

        case 'NAVIGATE_ERROR':
          setError(msg.error);
          break;

        default:
          console.warn('Unknown message type:', (msg as { type: string }).type);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setAuditResult, setIsAuditing, setProgress, setError]);

  // Helper functions to send messages to main context
  const sendMessage = (message: UIToMainMessage) => {
    parent.postMessage({ pluginMessage: message }, '*');
  };

  const runAudit = (scope: 'page' | 'selection') => {
    sendMessage({ type: 'RUN_AUDIT', scope });
  };

  const navigateToLayer = (layerId: string) => {
    sendMessage({ type: 'NAVIGATE_TO_LAYER', layerId });
  };

  const cancelAudit = () => {
    sendMessage({ type: 'CANCEL_AUDIT' });
  };

  return {
    runAudit,
    navigateToLayer,
    cancelAudit,
  };
}

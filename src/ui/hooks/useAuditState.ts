import { useState, useEffect } from 'react';
import type { AuditResult } from '@/shared/types';

/**
 * Audit state store using React hooks
 *
 * This is a singleton state manager that can be used across components
 * without prop drilling. Uses closure to maintain state outside of React.
 */

let auditResult: AuditResult | null = null;
let isAuditing = false;
let progress = 0;
let error: string | null = null;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Hook for managing audit state
 */
export function useAuditState() {
  const [, forceUpdate] = useState({});

  // Subscribe to state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  return {
    auditResult,
    isAuditing,
    progress,
    error,

    setAuditResult: (result: AuditResult | null) => {
      auditResult = result;
      notifyListeners();
    },

    setIsAuditing: (value: boolean) => {
      isAuditing = value;
      notifyListeners();
    },

    setProgress: (value: number) => {
      progress = value;
      notifyListeners();
    },

    setError: (value: string | null) => {
      error = value;
      notifyListeners();
    },

    reset: () => {
      auditResult = null;
      isAuditing = false;
      progress = 0;
      error = null;
      notifyListeners();
    },
  };
}

import { useState, useEffect } from 'react';
import type { AuditResult, AuditState, StyleGovernanceAuditResult } from '@/shared/types';

/**
 * Audit state store using React hooks with 7-state machine
 *
 * This is a singleton state manager that can be used across components
 * without prop drilling. Uses closure to maintain state outside of React.
 *
 * State machine: idle → validating → scanning → processing → complete
 *                                  ↓           ↓           ↓
 *                               error       error       error
 *                                  ↓           ↓           ↓
 *                              cancelled   cancelled
 */

// Valid state transitions (enforces state machine integrity)
const VALID_TRANSITIONS: Record<AuditState, AuditState[]> = {
  idle: ['validating'],
  validating: ['scanning', 'error'],
  scanning: ['processing', 'error', 'cancelled'],
  processing: ['complete', 'error', 'cancelled'],
  complete: ['idle'],
  error: ['idle'],
  cancelled: ['idle'],
};

// Singleton state
let auditState: AuditState = 'idle';
let auditResult: AuditResult | null = null;
let styleGovernanceResult: StyleGovernanceAuditResult | null = null;
let progress = 0;
let currentStep = '';
let error: string | null = null;
let isStale = false; // Document modified since audit

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Hook for managing audit state with 7-state machine
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
    // State
    auditState,
    auditResult,
    styleGovernanceResult,
    progress,
    currentStep,
    error,
    isStale,

    // Legacy compatibility
    isAuditing: auditState !== 'idle' && auditState !== 'complete' && auditState !== 'error',

    // State machine methods
    transitionTo: (newState: AuditState): boolean => {
      const validNext = VALID_TRANSITIONS[auditState];
      if (!validNext.includes(newState)) {
        console.error(`[AuditState] Invalid transition: ${auditState} → ${newState}`);
        return false;
      }
      auditState = newState;
      notifyListeners();
      return true;
    },

    canTransitionTo: (newState: AuditState): boolean => {
      const validNext = VALID_TRANSITIONS[auditState];
      return validNext.includes(newState);
    },

    // State setters
    setAuditState: (state: AuditState) => {
      // Direct setter (bypasses transition guards - use with caution)
      auditState = state;
      notifyListeners();
    },

    setAuditResult: (result: AuditResult | null) => {
      auditResult = result;
      notifyListeners();
    },

    setStyleGovernanceResult: (result: StyleGovernanceAuditResult | null) => {
      styleGovernanceResult = result;
      isStale = false; // Fresh result
      notifyListeners();
    },

    setProgress: (value: number, step?: string) => {
      progress = value;
      if (step !== undefined) {
        currentStep = step;
      }
      notifyListeners();
    },

    setError: (value: string | null) => {
      error = value;
      notifyListeners();
    },

    invalidate: () => {
      isStale = true;
      notifyListeners();
    },

    reset: () => {
      auditState = 'idle';
      auditResult = null;
      styleGovernanceResult = null;
      progress = 0;
      currentStep = '';
      error = null;
      isStale = false;
      notifyListeners();
    },
  };
}

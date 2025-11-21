import { useState, useEffect } from 'react';
import type { ReplacementState, ReplacementResult } from '@/shared/types';

/**
 * Replacement state store using React hooks with 7-state machine
 *
 * This is a singleton state manager for style/token replacement operations.
 * Uses closure to maintain state outside of React.
 *
 * State machine: idle → validating → creating_checkpoint → processing → complete
 *                          ↓                ↓                  ↓
 *                        error            error              error
 *
 * Note: No 'cancelled' state - replacements cannot be cancelled after checkpoint
 */

// Valid state transitions (enforces state machine integrity)
const VALID_TRANSITIONS: Record<ReplacementState, ReplacementState[]> = {
  idle: ['validating'],
  validating: ['creating_checkpoint', 'error'],
  creating_checkpoint: ['processing', 'error'],
  processing: ['complete', 'error'],
  complete: ['idle'],
  error: ['idle'],
};

// Singleton state
let replacementState: ReplacementState = 'idle';
let operationType: 'style' | 'token' | null = null;
let progress = 0;
let currentBatch = 0;
let totalBatches = 0;
let currentBatchSize = 100; // Adaptive sizing (100→25→100)
let layersProcessed = 0;
let failedLayersCount = 0;
let checkpointTitle: string | null = null;
let error: string | null = null;
let result: ReplacementResult | null = null;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Hook for managing replacement state with state machine
 */
export function useReplacementState() {
  const [, forceUpdate] = useState({});

  // Subscribe to state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  return {
    // State
    replacementState,
    operationType,
    progress,
    currentBatch,
    totalBatches,
    currentBatchSize,
    layersProcessed,
    failedLayersCount,
    checkpointTitle,
    error,
    result,

    // Computed
    isReplacing: replacementState !== 'idle' && replacementState !== 'complete' && replacementState !== 'error',

    // State machine methods
    transitionTo: (newState: ReplacementState): boolean => {
      const validNext = VALID_TRANSITIONS[replacementState];
      if (!validNext.includes(newState)) {
        console.error(`[ReplacementState] Invalid transition: ${replacementState} → ${newState}`);
        return false;
      }
      replacementState = newState;
      notifyListeners();
      return true;
    },

    canTransitionTo: (newState: ReplacementState): boolean => {
      const validNext = VALID_TRANSITIONS[replacementState];
      return validNext.includes(newState);
    },

    // State setters
    setReplacementState: (state: ReplacementState) => {
      // Direct setter (bypasses transition guards - use with caution)
      replacementState = state;
      notifyListeners();
    },

    setOperationType: (type: 'style' | 'token' | null) => {
      operationType = type;
      notifyListeners();
    },

    setProgress: (value: number) => {
      progress = value;
      notifyListeners();
    },

    setBatchInfo: (current: number, total: number, size: number) => {
      currentBatch = current;
      totalBatches = total;
      currentBatchSize = size;
      notifyListeners();
    },

    setLayersProcessed: (count: number) => {
      layersProcessed = count;
      notifyListeners();
    },

    setFailedLayersCount: (count: number) => {
      failedLayersCount = count;
      notifyListeners();
    },

    setCheckpointTitle: (title: string | null) => {
      checkpointTitle = title;
      notifyListeners();
    },

    setError: (value: string | null) => {
      error = value;
      notifyListeners();
    },

    setResult: (value: ReplacementResult | null) => {
      result = value;
      notifyListeners();
    },

    reset: () => {
      replacementState = 'idle';
      operationType = null;
      progress = 0;
      currentBatch = 0;
      totalBatches = 0;
      currentBatchSize = 100;
      layersProcessed = 0;
      failedLayersCount = 0;
      checkpointTitle = null;
      error = null;
      result = null;
      notifyListeners();
    },
  };
}

import { useState, useEffect } from 'react';
import type { AuditResult, AuditState, StyleGovernanceAuditResult } from '@/shared/types';
import { calculateOptimizedMetrics } from '@/ui/utils/metricsCalculator';

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
let auditStartTime: number | null = null; // Track when audit started

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
      // If already in target state, silently succeed (no-op)
      if (auditState === newState) {
        return true;
      }

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

    // STREAMING: Accumulate partial results (Phase 2.3.1)
    accumulatePartialResult: (newLayers: any[], newStyles: any[], newTokens: any[], newLibraries: any[]) => {
      if (!styleGovernanceResult) {
        // First partial result - initialize structure
        console.log('[AuditState] Initializing styleGovernanceResult for accumulation');

        // Track when audit started
        auditStartTime = Date.now();

        styleGovernanceResult = {
          layers: [],
          styles: [],
          tokens: [],
          libraries: [],
          styleHierarchy: [],
          metrics: {} as any,
          styledLayers: [],
          unstyledLayers: [],
          timestamp: new Date(),
          documentName: '',
          documentId: '',
          totalPages: 0,
          totalTextLayers: 0,
          isStale: false,
          auditDuration: 0,
        };
      }

      // Accumulate new layers
      styleGovernanceResult.layers = styleGovernanceResult.layers.concat(newLayers);

      // Accumulate new styles (avoid duplicates by ID)
      const existingStyleIds = new Set(styleGovernanceResult.styles.map(s => s.id));
      for (const style of newStyles) {
        if (!existingStyleIds.has(style.id)) {
          styleGovernanceResult.styles.push(style);
          existingStyleIds.add(style.id);
        }
      }

      // Accumulate new tokens (avoid duplicates by ID)
      const existingTokenIds = new Set(styleGovernanceResult.tokens.map(t => t.id));
      for (const token of newTokens) {
        if (!existingTokenIds.has(token.id)) {
          styleGovernanceResult.tokens.push(token);
          existingTokenIds.add(token.id);
        }
      }

      // Accumulate new libraries (avoid duplicates by key)
      const existingLibraryKeys = new Set(styleGovernanceResult.libraries.map(l => l.key));
      for (const library of newLibraries) {
        if (!existingLibraryKeys.has(library.key)) {
          styleGovernanceResult.libraries.push(library);
          existingLibraryKeys.add(library.key);
        }
      }

      // Recalculate categorized layers
      styleGovernanceResult.styledLayers = styleGovernanceResult.layers.filter(
        l => l.styleAssignment?.assignmentStatus === 'fully-styled'
      );
      styleGovernanceResult.unstyledLayers = styleGovernanceResult.layers.filter(
        l => l.styleAssignment?.assignmentStatus === 'unstyled'
      );

      // Update metrics
      styleGovernanceResult.metrics = {
        totalLayers: styleGovernanceResult.layers.length,
        totalStyles: styleGovernanceResult.styles.length,
        styledLayers: styleGovernanceResult.styledLayers.length,
        unstyledLayers: styleGovernanceResult.unstyledLayers.length,
        partiallyStyledLayers: styleGovernanceResult.layers.filter(
          l => l.styleAssignment?.assignmentStatus === 'partially-styled'
        ).length,
        styleCoverage: styleGovernanceResult.layers.length > 0
          ? Math.round((styleGovernanceResult.styledLayers.length / styleGovernanceResult.layers.length) * 100)
          : 0,
      } as any;

      // DEBUG: Log accumulated totals
      console.log(
        `[AuditState] Accumulated totals: ${styleGovernanceResult.layers.length} layers, ` +
        `${styleGovernanceResult.styles.length} styles, ${styleGovernanceResult.tokens.length} tokens, ` +
        `${styleGovernanceResult.libraries.length} libraries`
      );

      notifyListeners();
    },

    // STREAMING: Finalize accumulated result by calculating full metrics (Phase 2.3.4)
    finalizeAccumulatedResult: () => {
      if (!styleGovernanceResult) {
        console.warn('[AuditState] Cannot finalize - no accumulated result');
        return;
      }

      console.log('[AuditState] Finalizing accumulated result - calculating metrics...');

      // Calculate audit duration
      if (auditStartTime) {
        styleGovernanceResult.auditDuration = Date.now() - auditStartTime;
        console.log(`[AuditState] Audit duration: ${styleGovernanceResult.auditDuration}ms`);
      }

      // Update totalTextLayers
      styleGovernanceResult.totalTextLayers = styleGovernanceResult.layers.length;

      // Calculate full metrics using the accumulated data
      const calculatedMetrics = calculateOptimizedMetrics(styleGovernanceResult);

      // Update the result with calculated metrics
      styleGovernanceResult.metrics = calculatedMetrics;

      console.log('[AuditState] Metrics calculated:', {
        styleAdoptionRate: calculatedMetrics.styleAdoptionRate.toFixed(1) + '%',
        tokenAdoptionRate: calculatedMetrics.tokenAdoptionRate.toFixed(1) + '%',
        totalLayers: calculatedMetrics.elementCount,
        fullyStyledCount: calculatedMetrics.fullyStyledCount,
      });

      notifyListeners();
    },

    // Merge missing fonts data from the final result into the accumulated result
    mergeMissingFontsData: (data: {
      layersWithMissingFonts: number;
      missingFontLayerNames: string[];
      missingFontLayerIds: string[];
    }) => {
      if (!styleGovernanceResult) {
        console.warn('[AuditState] Cannot merge missing fonts data - no accumulated result');
        return;
      }

      console.log('[AuditState] Merging missing fonts data:', data);

      styleGovernanceResult.layersWithMissingFonts = data.layersWithMissingFonts;
      styleGovernanceResult.missingFontLayerNames = data.missingFontLayerNames;
      styleGovernanceResult.missingFontLayerIds = data.missingFontLayerIds;

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
      auditStartTime = null;
      notifyListeners();
    },
  };
}

import React from 'react';
import type { AuditResult } from '@/shared/types';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useAuditState } from './hooks/useAuditState';
import './styles/globals.css';

/**
 * Main App component - Root of the plugin UI
 */
export default function App() {
  // Message handling and state management
  const { runAudit, navigateToLayer, cancelAudit } = useMessageHandler();
  const { auditResult, isAuditing, progress, error } = useAuditState();

  return (
    <div className="min-h-screen bg-figma-bg text-figma-text p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-figma-text mb-2">
            Figma Font Audit Pro
          </h1>
          <p className="text-figma-text-secondary text-sm">
            Comprehensive font and text style analysis
          </p>
        </header>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => runAudit('page')}
            disabled={isAuditing}
            className="px-4 py-2 bg-figma-bg-brand text-figma-text-onbrand rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuditing ? 'Auditing...' : 'Run Audit on Page'}
          </button>
          <button
            onClick={() => runAudit('selection')}
            disabled={isAuditing}
            className="px-4 py-2 bg-figma-bg-secondary text-figma-text rounded-md hover:bg-figma-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Audit Selection
          </button>
          {isAuditing && (
            <button
              onClick={cancelAudit}
              className="px-4 py-2 bg-figma-bg-danger text-white rounded-md hover:opacity-90"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progress Indicator */}
        {isAuditing && (
          <div className="mb-6 p-4 bg-figma-bg-secondary rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-figma-text-secondary">
                Analyzing text layers...
              </span>
              <span className="text-sm font-medium text-figma-text">
                {progress}%
              </span>
            </div>
            <div className="w-full bg-figma-bg-tertiary rounded-full h-2">
              <div
                className="bg-figma-bg-brand h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-figma-bg-danger bg-opacity-10 border border-figma-bg-danger rounded-md">
            <p className="text-sm text-figma-bg-danger">{error}</p>
          </div>
        )}

        {/* Results Placeholder */}
        {auditResult && !isAuditing && (
          <div className="bg-figma-bg-secondary rounded-md p-6">
            <h2 className="text-lg font-semibold mb-4">Audit Results</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-figma-text-secondary">Total text layers:</span>{' '}
                <span className="font-medium">{auditResult.summary.totalTextLayers}</span>
              </p>
              <p>
                <span className="text-figma-text-secondary">Unique fonts:</span>{' '}
                <span className="font-medium">{auditResult.summary.uniqueFontFamilies}</span>
              </p>
              <p>
                <span className="text-figma-text-secondary">Style coverage:</span>{' '}
                <span className="font-medium">
                  {auditResult.summary.styleCoveragePercent.toFixed(1)}%
                </span>
              </p>
              <p className="text-figma-text-tertiary text-xs pt-2">
                Timestamp: {new Date(auditResult.timestamp).toLocaleString()}
              </p>
            </div>
            {/* TODO: Add detailed results components in Phase 3 (US1) */}
          </div>
        )}

        {/* Empty State */}
        {!auditResult && !isAuditing && !error && (
          <div className="text-center py-12">
            <p className="text-figma-text-secondary mb-4">
              No audit data yet. Click "Run Audit on Page" to begin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

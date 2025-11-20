import React from 'react';
import type { AuditResult } from '@/shared/types';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useAuditState } from './hooks/useAuditState';
import SummaryDashboard from './components/SummaryDashboard';
import AuditResults from './components/AuditResults';
import ProgressIndicator from './components/ProgressIndicator';
import ErrorDisplay from './components/ErrorDisplay';
import './styles/globals.css';

/**
 * Main App component - Root of the plugin UI
 */
export default function App() {
  // Message handling and state management
  const { runAudit, navigateToLayer, cancelAudit } = useMessageHandler();
  const { auditResult, isAuditing, progress, error, setError } = useAuditState();

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
          <div className="mb-6">
            <ProgressIndicator
              progress={progress}
              message="Analyzing text layers..."
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <ErrorDisplay
              error={error}
              onDismiss={() => setError(null)}
              onRetry={() => runAudit('page')}
            />
          </div>
        )}

        {/* Audit Results */}
        {auditResult && !isAuditing && (
          <div className="space-y-6">
            {/* Summary Dashboard */}
            <SummaryDashboard summary={auditResult.summary} />

            {/* Detailed Results */}
            <AuditResults
              textLayers={auditResult.textLayers}
              onNavigate={navigateToLayer}
            />

            {/* Footer Info */}
            <div className="text-xs text-figma-text-tertiary text-center pt-4 border-t border-figma-border">
              <p>File: {auditResult.fileName}</p>
              <p>Timestamp: {new Date(auditResult.timestamp).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!auditResult && !isAuditing && !error && (
          <div className="text-center py-16 px-4">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-figma-text mb-2">
              Ready to Audit
            </h3>
            <p className="text-figma-text-secondary text-sm max-w-md mx-auto">
              Discover all text layers, analyze font usage, detect text style
              assignments, and identify opportunities for better consistency.
            </p>
            <div className="mt-6 text-xs text-figma-text-tertiary">
              <p>💡 Tip: Select specific frames to audit just that area</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

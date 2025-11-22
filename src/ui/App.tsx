import React from 'react';
import './styles/globals.css';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useAuditState } from './hooks/useAuditState';
import SummaryDashboard from './components/SummaryDashboard';
import AuditResults from './components/AuditResults';
import ProgressIndicator from './components/ProgressIndicator';
import ErrorDisplay from './components/ErrorDisplay';

/**
 * Main App component - Root of the plugin UI
 *
 * Orchestrates the audit workflow and displays appropriate views
 * based on the current audit state.
 */
export default function App() {
  // Get message handlers for communication with main context
  const { runStyleAudit, navigateToLayer, cancelStyleAudit } = useMessageHandler();

  // Get audit state
  const { auditResult, styleGovernanceResult, isAuditing, progress, error, reset, auditState } =
    useAuditState();

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRunAuditPage = () => {
    reset();
    runStyleAudit({ includeHiddenLayers: false, includeTokens: false });
  };

  const handleRunAuditSelection = () => {
    reset();
    runStyleAudit({ includeHiddenLayers: false, includeTokens: false });
  };

  const handleCancelAudit = () => {
    cancelStyleAudit();
    reset();
  };

  const handleNavigateToLayer = (layerId: string) => {
    navigateToLayer(layerId);
  };

  const handleDismissError = () => {
    reset();
  };

  // ============================================================================
  // Render Views
  // ============================================================================

  return (
    <div className="min-h-screen bg-figma-bg text-figma-text p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Figma Font Audit Pro</h1>
        <p className="text-sm text-figma-text-secondary">
          Comprehensive font and text style analysis
        </p>
      </div>

      {/* Error State */}
      {error && !isAuditing && <ErrorDisplay error={error} onDismiss={handleDismissError} />}

      {/* Auditing State */}
      {isAuditing && (
        <div className="space-y-4">
          <ProgressIndicator progress={progress} message="Analyzing text layers..." />
        </div>
      )}

      {/* Initial State - No Audit */}
      {!isAuditing && !auditResult && !styleGovernanceResult && !error && (
        <div className="space-y-4">
          <div className="bg-figma-bg-secondary rounded-lg p-6 border border-figma-border">
            <h2 className="text-lg font-semibold mb-2">Ready to audit</h2>
            <p className="text-sm text-figma-text-secondary mb-4">
              Choose a scope to begin analyzing fonts and text styles in your design.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleRunAuditPage}
                className="
                  btn btn-primary w-full
                  px-4 py-2 rounded-md
                  bg-figma-bg-brand hover:bg-figma-bg-brand-hover
                  text-white font-medium
                  transition-colors
                "
              >
                Run Audit on Current Page
              </button>

              <button
                onClick={handleRunAuditSelection}
                className="
                  btn btn-secondary w-full
                  px-4 py-2 rounded-md
                  bg-figma-bg-secondary hover:bg-figma-bg-tertiary
                  border border-figma-border
                  text-figma-text font-medium
                  transition-colors
                "
              >
                Run Audit on Selection
              </button>
            </div>
          </div>

          <div className="text-xs text-figma-text-secondary">
            <p>
              <strong>Tip:</strong> The audit will analyze all text layers and provide detailed
              information about fonts, styles, and potential improvements.
            </p>
          </div>
        </div>
      )}

      {/* Results State - Style Governance Audit */}
      {!isAuditing && styleGovernanceResult && !error && (
        <div className="space-y-6">
          {/* Summary Dashboard */}
          <div className="bg-figma-bg-secondary rounded-lg p-6 border border-figma-border">
            <h2 className="text-lg font-semibold mb-4">Audit Results</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-figma-text-secondary">Document</p>
                <p className="text-sm font-medium">{styleGovernanceResult.documentName}</p>
              </div>
              <div>
                <p className="text-xs text-figma-text-secondary">Total Layers</p>
                <p className="text-sm font-medium">{styleGovernanceResult.totalTextLayers}</p>
              </div>
              <div>
                <p className="text-xs text-figma-text-secondary">Pages</p>
                <p className="text-sm font-medium">{styleGovernanceResult.totalPages}</p>
              </div>
              <div>
                <p className="text-xs text-figma-text-secondary">Unstyled</p>
                <p className="text-sm font-medium">{styleGovernanceResult.metrics.unstyledCount}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-figma-border">
            <button
              onClick={handleRunAuditPage}
              className="
                flex-1 px-4 py-2 rounded-md
                bg-figma-bg-brand hover:bg-figma-bg-brand-hover
                text-white font-medium text-sm
                transition-colors
              "
            >
              Run New Audit
            </button>

            <button
              onClick={reset}
              className="
                px-4 py-2 rounded-md
                bg-figma-bg-secondary hover:bg-figma-bg-tertiary
                border border-figma-border
                text-figma-text font-medium text-sm
                transition-colors
              "
            >
              Clear Results
            </button>
          </div>

          {/* Metadata */}
          <div className="text-xs text-figma-text-secondary">
            <p>
              Document: {styleGovernanceResult.documentName} • Layers:{' '}
              {styleGovernanceResult.totalTextLayers} • Completed:{' '}
              {typeof styleGovernanceResult.timestamp === 'string'
                ? new Date(styleGovernanceResult.timestamp).toLocaleString()
                : styleGovernanceResult.timestamp instanceof Date
                  ? styleGovernanceResult.timestamp.toLocaleString()
                  : 'Unknown'}
            </p>
          </div>
        </div>
      )}

      {/* Results State - Legacy Font Audit (backward compatibility) */}
      {!isAuditing && auditResult && !styleGovernanceResult && !error && (
        <div className="space-y-6">
          {/* Summary Dashboard */}
          <SummaryDashboard summary={auditResult.summary} />

          {/* Audit Results */}
          <AuditResults textLayers={auditResult.textLayers} onNavigate={handleNavigateToLayer} />

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-figma-border">
            <button
              onClick={handleRunAuditPage}
              className="
                flex-1 px-4 py-2 rounded-md
                bg-figma-bg-brand hover:bg-figma-bg-brand-hover
                text-white font-medium text-sm
                transition-colors
              "
            >
              Run New Audit
            </button>

            <button
              onClick={reset}
              className="
                px-4 py-2 rounded-md
                bg-figma-bg-secondary hover:bg-figma-bg-tertiary
                border border-figma-border
                text-figma-text font-medium text-sm
                transition-colors
              "
            >
              Clear Results
            </button>
          </div>

          {/* Metadata */}
          <div className="text-xs text-figma-text-secondary">
            <p>
              File: {auditResult.fileName} • Completed:{' '}
              {new Date(auditResult.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

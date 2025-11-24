import { useState } from 'react';
import './styles/globals.css';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useAuditState } from './hooks/useAuditState';
import SummaryDashboard from './components/SummaryDashboard';
import AuditResults from './components/AuditResults';
import ProgressIndicator from './components/ProgressIndicator';
import ErrorDisplay from './components/ErrorDisplay';
import TokenView from './components/TokenView';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import DetailPanel from './components/DetailPanel';
import StyleTreeView from './components/StyleTreeView';
import StylePicker from './components/StylePicker';
import { TokenPicker } from './components/TokenPicker';
import ConfirmationDialog from './components/ConfirmationDialog';
import type { TextStyle, DesignToken } from '@/shared/types';

/**
 * Main App component - Root of the plugin UI
 *
 * Orchestrates the audit workflow and displays appropriate views
 * based on the current audit state.
 */
export default function App() {
  // Tab state for results view
  const [activeTab, setActiveTab] = useState<'summary' | 'styles' | 'tokens' | 'analytics'>(
    'summary'
  );
  // Detail panel selection state
  const [selectedStyle, setSelectedStyle] = useState<TextStyle | null>(null);
  const [selectedToken, setSelectedToken] = useState<DesignToken | null>(null);

  // Replacement workflow state
  const [replacementState, setReplacementState] = useState<
    'idle' | 'picking-style' | 'picking-token' | 'confirming'
  >('idle');
  const [sourceStyle, setSourceStyle] = useState<TextStyle | null>(null);
  const [targetStyle, setTargetStyle] = useState<TextStyle | null>(null);
  const [sourceToken, setSourceToken] = useState<DesignToken | null>(null);
  const [targetToken, setTargetToken] = useState<DesignToken | null>(null);
  const [replacementType, setReplacementType] = useState<'style' | 'token' | null>(null);
  const [affectedLayerIds, setAffectedLayerIds] = useState<string[]>([]);

  // Get message handlers for communication with main context
  const { runStyleAudit, navigateToLayer, replaceStyle, replaceToken } = useMessageHandler();

  // Get audit state
  const { auditResult, styleGovernanceResult, isAuditing, progress, error, reset } =
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

  const handleNavigateToLayer = (layerId: string) => {
    navigateToLayer(layerId);
  };

  const handleDismissError = () => {
    reset();
  };

  // Replacement workflow handlers
  const handleReplaceStyle = (style: TextStyle, layerIds: string[]) => {
    setSourceStyle(style);
    setSourceToken(null);
    setReplacementType('style');
    setAffectedLayerIds(layerIds);
    setReplacementState('picking-style');
  };

  const handleReplaceToken = (token: DesignToken, layerIds: string[]) => {
    setSourceToken(token);
    setSourceStyle(null);
    setReplacementType('token');
    setAffectedLayerIds(layerIds);
    setReplacementState('picking-token');
  };

  const handleStylePickerSelect = (target: TextStyle) => {
    if (sourceStyle && replacementType === 'style') {
      setTargetStyle(target);
      setReplacementState('confirming');
    }
  };

  const handleTokenPickerSelect = (target: DesignToken) => {
    if (sourceToken && replacementType === 'token') {
      setTargetToken(target);
      setReplacementState('confirming');
    }
  };

  const handleConfirmReplacement = async () => {
    if (affectedLayerIds.length === 0) return;

    if (replacementType === 'style' && sourceStyle && targetStyle) {
      console.log('[UI] Confirming style replacement:', {
        sourceStyleId: sourceStyle.id,
        targetStyleId: targetStyle.id,
        affectedLayerCount: affectedLayerIds.length,
      });

      await replaceStyle(sourceStyle.id, targetStyle.id, affectedLayerIds);

      // Reset replacement state
      setReplacementState('idle');
      setSourceStyle(null);
      setTargetStyle(null);
      setReplacementType(null);
      setAffectedLayerIds([]);
    } else if (replacementType === 'token' && sourceToken && targetToken) {
      console.log('[UI] Confirming token replacement:', {
        sourceTokenId: sourceToken.id,
        targetTokenId: targetToken.id,
        affectedLayerCount: affectedLayerIds.length,
      });

      await replaceToken(sourceToken.id, targetToken.id, affectedLayerIds);

      // Reset replacement state
      setReplacementState('idle');
      setSourceToken(null);
      setTargetToken(null);
      setReplacementType(null);
      setAffectedLayerIds([]);
    } else {
      console.warn('[UI] Cannot confirm replacement - missing required state', {
        replacementType,
        hasSourceStyle: !!sourceStyle,
        hasTargetStyle: !!targetStyle,
        hasSourceToken: !!sourceToken,
        hasTargetToken: !!targetToken,
      });
    }
  };

  const handleCancelReplacement = () => {
    setReplacementState('idle');
    setSourceStyle(null);
    setTargetStyle(null);
    setSourceToken(null);
    setTargetToken(null);
    setReplacementType(null);
    setAffectedLayerIds([]);
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
          {/* Tabs */}
          <div className="bg-figma-bg-secondary rounded-lg border border-figma-border">
            <div className="flex border-b border-figma-border">
              <button
                onClick={() => setActiveTab('summary')}
                className={`
                   flex-1 px-4 py-3 text-sm font-medium text-center
                   transition-colors border-b-2
                   ${
                     activeTab === 'summary'
                       ? 'border-figma-bg-brand text-figma-text'
                       : 'border-transparent text-figma-text-secondary hover:text-figma-text'
                   }
                 `}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab('styles')}
                className={`
                    flex-1 px-4 py-3 text-sm font-medium text-center
                    transition-colors border-b-2
                    ${
                      activeTab === 'styles'
                        ? 'border-figma-bg-brand text-figma-text'
                        : 'border-transparent text-figma-text-secondary hover:text-figma-text'
                    }
                  `}
              >
                Styles ({styleGovernanceResult.styles.length})
              </button>
              <button
                onClick={() => setActiveTab('tokens')}
                className={`
                    flex-1 px-4 py-3 text-sm font-medium text-center
                    transition-colors border-b-2
                    ${
                      activeTab === 'tokens'
                        ? 'border-figma-bg-brand text-figma-text'
                        : 'border-transparent text-figma-text-secondary hover:text-figma-text'
                    }
                  `}
              >
                Tokens ({styleGovernanceResult.tokens.length})
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`
                   flex-1 px-4 py-3 text-sm font-medium text-center
                   transition-colors border-b-2
                   ${
                     activeTab === 'analytics'
                       ? 'border-figma-bg-brand text-figma-text'
                       : 'border-transparent text-figma-text-secondary hover:text-figma-text'
                   }
                 `}
              >
                Analytics
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {/* Document Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-figma-text-secondary">Document</p>
                      <p className="text-sm font-medium">{styleGovernanceResult.documentName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-figma-text-secondary">Pages</p>
                      <p className="text-sm font-medium">{styleGovernanceResult.totalPages}</p>
                    </div>
                  </div>

                  {/* Text Layers Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-figma-text-secondary">Total Layers</p>
                      <p className="text-sm font-medium">{styleGovernanceResult.totalTextLayers}</p>
                    </div>
                    <div>
                      <p className="text-xs text-figma-text-secondary">Unstyled</p>
                      <p className="text-sm font-medium text-red-500">
                        {styleGovernanceResult.metrics.unstyledCount}
                      </p>
                    </div>
                  </div>

                  {/* Style Adoption */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-figma-text-secondary">Fully Styled</p>
                      <p className="text-sm font-medium text-green-500">
                        {styleGovernanceResult.metrics.fullyStyledCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-figma-text-secondary">Partially Styled</p>
                      <p className="text-sm font-medium text-yellow-500">
                        {styleGovernanceResult.metrics.partiallyStyledCount}
                      </p>
                    </div>
                  </div>

                  {/* Token Info */}
                  {styleGovernanceResult.tokens.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-figma-border">
                      <div>
                        <p className="text-xs text-figma-text-secondary">Total Tokens</p>
                        <p className="text-sm font-medium">{styleGovernanceResult.tokens.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-figma-text-secondary">Token Coverage</p>
                        <p className="text-sm font-medium">
                          {styleGovernanceResult.metrics.tokenCoverageRate}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Audit Details */}
                  <div className="pt-4 border-t border-figma-border">
                    <p className="text-xs text-figma-text-secondary mb-2">Audit Duration</p>
                    <p className="text-sm font-medium">{styleGovernanceResult.auditDuration}ms</p>
                  </div>
                </div>
              )}

              {/* Styles Tab */}
              {activeTab === 'styles' && (
                <StyleTreeView
                  styles={styleGovernanceResult.styles}
                  libraries={styleGovernanceResult.libraries}
                  unstyledLayers={styleGovernanceResult.unstyledLayers}
                  onStyleSelect={setSelectedStyle}
                />
              )}

              {/* Tokens Tab */}
              {activeTab === 'tokens' && (
                <TokenView
                  tokens={styleGovernanceResult.tokens}
                  isLoading={false}
                  onTokenSelect={setSelectedToken}
                />
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <AnalyticsDashboard auditResult={styleGovernanceResult} isLoading={false} />
              )}
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

          {/* Detail Panel for selected style/token */}
          {(selectedStyle || selectedToken) && (
            <div className="border-t border-figma-border pt-4">
              <DetailPanel
                selectedStyle={selectedStyle}
                selectedToken={selectedToken}
                allLayers={styleGovernanceResult.layers}
                onNavigateToLayer={handleNavigateToLayer}
                onReplaceStyle={handleReplaceStyle}
                onReplaceToken={handleReplaceToken}
              />
            </div>
          )}
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

      {/* StylePicker Modal for Style Replacement */}
      {styleGovernanceResult && replacementState === 'picking-style' && sourceStyle && (
        <StylePicker
          isOpen={replacementState === 'picking-style'}
          styles={styleGovernanceResult.styles}
          libraries={styleGovernanceResult.libraries}
          currentStyleId={sourceStyle.id}
          onSelect={(targetStyle) => {
            // Store selected target style and move to confirmation
            const picker = document.querySelector('[data-style-picker]') as any;
            if (picker) {
              picker.dataset.selectedTargetId = targetStyle.id;
              picker.dataset.selectedTargetName = targetStyle.name;
            }
            handleStylePickerSelect(targetStyle);
          }}
          onCancel={handleCancelReplacement}
          title="Select Target Style"
          description={`Replace "${sourceStyle.name}" in ${affectedLayerIds.length} layer${affectedLayerIds.length !== 1 ? 's' : ''}`}
        />
      )}

      {/* TokenPicker Modal for Token Replacement */}
      {styleGovernanceResult && replacementState === 'picking-token' && sourceToken && (
        <TokenPicker
          isOpen={replacementState === 'picking-token'}
          tokens={styleGovernanceResult.tokens}
          currentTokenId={sourceToken.id}
          onSelect={(targetToken) => {
            // Store selected target token and move to confirmation
            const picker = document.querySelector('[data-token-picker]') as any;
            if (picker) {
              picker.dataset.selectedTargetId = targetToken.id;
              picker.dataset.selectedTargetName = targetToken.name;
            }
            handleTokenPickerSelect(targetToken);
          }}
          onCancel={handleCancelReplacement}
          title="Select Target Token"
          description={`Replace "${sourceToken.name}" in ${affectedLayerIds.length} layer${affectedLayerIds.length !== 1 ? 's' : ''}`}
        />
      )}

      {/* Confirmation Dialog for Style Replacement */}
      {styleGovernanceResult &&
        replacementState === 'confirming' &&
        sourceStyle &&
        replacementType === 'style' && (
          <ConfirmationDialog
            isOpen={replacementState === 'confirming'}
            title="Confirm Style Replacement"
            message={`Replace all instances of "${sourceStyle.name}" with the selected style in ${affectedLayerIds.length} layer${affectedLayerIds.length !== 1 ? 's' : ''}?\n\nThis will create a version checkpoint for safety.`}
            confirmLabel="Replace"
            cancelLabel="Cancel"
            variant="warning"
            onConfirm={handleConfirmReplacement}
            onCancel={() => setReplacementState('picking-style')}
          />
        )}

      {/* Confirmation Dialog for Token Replacement */}
      {styleGovernanceResult &&
        replacementState === 'confirming' &&
        sourceToken &&
        replacementType === 'token' && (
          <ConfirmationDialog
            isOpen={replacementState === 'confirming'}
            title="Confirm Token Replacement"
            message={`Replace all instances of "${sourceToken.name}" with the selected token in ${affectedLayerIds.length} layer${affectedLayerIds.length !== 1 ? 's' : ''}?\n\nThis will create a version checkpoint for safety.`}
            confirmLabel="Replace"
            cancelLabel="Cancel"
            variant="warning"
            onConfirm={handleConfirmReplacement}
            onCancel={() => setReplacementState('picking-token')}
          />
        )}
    </div>
  );
}

import { useState } from 'react';
import './styles/globals.css';
import { useMessageHandler } from './hooks/useMessageHandler';
import { useAuditState } from './hooks/useAuditState';
import Sidebar, { type TabType } from './components/Sidebar';
import Header from './components/Header';
import EmptyState from './components/EmptyState';
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
 * based on the current audit state. Now with sidebar navigation.
 */
export default function App() {
  // Tab state for navigation - Analytics is now default
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

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
  const { styleGovernanceResult, isAuditing, progress, error, reset } = useAuditState();

  // Calculate which tabs should be disabled
  const disabledTabs: TabType[] = !styleGovernanceResult ? ['styles', 'tokens'] : [];

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRunAuditPage = () => {
    reset();
    runStyleAudit({ includeHiddenLayers: false, includeTokens: true });
  };

  const handleRunAuditSelection = () => {
    reset();
    runStyleAudit({ includeHiddenLayers: false, includeTokens: true });
  };

  const handleNavigateToLayer = (layerId: string) => {
    navigateToLayer(layerId);
  };

  const handleDismissError = () => {
    reset();
  };

  const handleNewAnalysis = () => {
    reset();
    setSelectedStyle(null);
    setSelectedToken(null);
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
  // Render
  // ============================================================================

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        backgroundColor: 'var(--figma-color-bg)',
        color: 'var(--figma-color-text)',
      }}
    >
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} disabledTabs={disabledTabs} />

      {/* Main Content Area */}
      <div
        style={{
          marginLeft: '48px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Header
          activeTab={activeTab}
          showActions={!!styleGovernanceResult && !isAuditing}
          onNewAnalysis={handleNewAnalysis}
        />

        {/* Content */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Error State */}
          {error && !isAuditing && (
            <div style={{ padding: 'var(--figma-space-md)' }}>
              <ErrorDisplay error={error} onDismiss={handleDismissError} />
            </div>
          )}

          {/* Auditing State */}
          {isAuditing && (
            <div style={{ padding: 'var(--figma-space-md)' }}>
              <ProgressIndicator progress={progress} message="Analyzing text layers..." />
            </div>
          )}

          {/* Empty State - No Audit */}
          {!isAuditing && !styleGovernanceResult && !error && (
            <>
              {activeTab === 'analytics' && (
                <EmptyState
                  message="Analyze the text styles and components in your Figma design files."
                  onAnalyzeFile={handleRunAuditPage}
                  onAnalyzeSelection={handleRunAuditSelection}
                />
              )}
              {activeTab === 'styles' && (
                <EmptyState
                  message="Run an audit to see text styles in your document."
                  onAnalyzeFile={handleRunAuditPage}
                  onAnalyzeSelection={handleRunAuditSelection}
                />
              )}
              {activeTab === 'tokens' && (
                <EmptyState
                  message="Run an audit to see design tokens in your document."
                  onAnalyzeFile={handleRunAuditPage}
                  onAnalyzeSelection={handleRunAuditSelection}
                />
              )}
            </>
          )}

          {/* Results State - Has Audit Data */}
          {!isAuditing && styleGovernanceResult && !error && (
            <div
              style={{
                display: 'flex',
                height: '100%',
                overflow: 'hidden',
              }}
            >
              {/* Main Content - Left Side */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: 'var(--figma-space-md)',
                }}
              >
                {/* Analytics Tab */}
                {activeTab === 'analytics' && (
                  <AnalyticsDashboard auditResult={styleGovernanceResult} />
                )}

                {/* Styles Tab */}
                {activeTab === 'styles' && (
                  <div style={{ display: 'flex', gap: 'var(--figma-space-md)' }}>
                    <div style={{ flex: 1 }}>
                      <StyleTreeView
                        styles={styleGovernanceResult.styles}
                        libraries={styleGovernanceResult.libraries}
                        unstyledLayers={styleGovernanceResult.unstyledLayers}
                        onStyleSelect={setSelectedStyle}
                      />
                    </div>
                    {selectedStyle && (
                      <div style={{ width: '400px', flexShrink: 0 }}>
                        <DetailPanel
                          selectedStyle={selectedStyle}
                          allLayers={styleGovernanceResult.layers}
                          onNavigateToLayer={handleNavigateToLayer}
                          onReplaceStyle={handleReplaceStyle}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Tokens Tab */}
                {activeTab === 'tokens' && (
                  <div style={{ display: 'flex', gap: 'var(--figma-space-md)' }}>
                    <div style={{ flex: 1 }}>
                      <TokenView
                        tokens={styleGovernanceResult.tokens}
                        onTokenSelect={setSelectedToken}
                      />
                    </div>
                    {selectedToken && (
                      <div style={{ width: '400px', flexShrink: 0 }}>
                        <DetailPanel
                          selectedToken={selectedToken}
                          allLayers={styleGovernanceResult.layers}
                          onNavigateToLayer={handleNavigateToLayer}
                          onReplaceToken={handleReplaceToken}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Style Picker Modal */}
      {styleGovernanceResult && replacementState === 'picking-style' && sourceStyle && (
        <StylePicker
          isOpen={replacementState === 'picking-style'}
          styles={styleGovernanceResult.styles}
          libraries={styleGovernanceResult.libraries}
          currentStyleId={sourceStyle.id}
          onSelect={handleStylePickerSelect}
          onCancel={() => setReplacementState('idle')}
        />
      )}

      {/* Token Picker Modal */}
      {styleGovernanceResult && replacementState === 'picking-token' && sourceToken && (
        <TokenPicker
          isOpen={replacementState === 'picking-token'}
          tokens={styleGovernanceResult.tokens}
          currentTokenId={sourceToken.id}
          onSelect={handleTokenPickerSelect}
          onCancel={() => setReplacementState('idle')}
        />
      )}

      {/* Confirmation Dialog */}
      {replacementState === 'confirming' &&
        ((replacementType === 'style' && sourceStyle && targetStyle) ||
          (replacementType === 'token' && sourceToken && targetToken)) && (
          <ConfirmationDialog
            isOpen={replacementState === 'confirming'}
            title={`Replace ${replacementType === 'style' ? 'Style' : 'Token'}`}
            message={
              replacementType === 'style'
                ? `Replace all instances of "${sourceStyle?.name}" with "${targetStyle?.name}" in ${affectedLayerIds.length} layer${affectedLayerIds.length !== 1 ? 's' : ''}?\n\nThis will create a version checkpoint for safety.`
                : `Replace all instances of "${sourceToken?.name}" with "${targetToken?.name}" in ${affectedLayerIds.length} layer${affectedLayerIds.length !== 1 ? 's' : ''}?\n\nThis will create a version checkpoint for safety.`
            }
            confirmLabel="Replace"
            cancelLabel="Cancel"
            onConfirm={handleConfirmReplacement}
            onCancel={handleCancelReplacement}
          />
        )}
    </div>
  );
}

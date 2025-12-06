import { useState, useEffect } from 'react';
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
import StyleReplacementPanel from './components/StyleReplacementPanel';
import TokenReplacementPanel from './components/TokenReplacementPanel';
import FilterToolbar from './components/FilterToolbar';
import Toast from './components/Toast';
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

  // Filter state for Styles tab
  const [stylesSearchQuery, setStylesSearchQuery] = useState('');
  const [stylesSourceFilter, setStylesSourceFilter] = useState<'all' | 'local' | 'library' | 'unused'>('all');
  const [stylesGroupByLibrary, setStylesGroupByLibrary] = useState(true);

  // Filter state for Tokens tab
  const [tokensSearchQuery, setTokensSearchQuery] = useState('');
  const [tokensSourceFilter, setTokensSourceFilter] = useState<'all' | 'local' | 'library'>('all');
  const [tokensTypeFilter, setTokensTypeFilter] = useState<'all' | 'color' | 'number' | 'string' | 'boolean'>('all');
  const [tokensGroupByLibrary, setTokensGroupByLibrary] = useState(true);

  // Replacement workflow state (old modal-based - keeping for token replacement)
  const [replacementState, setReplacementState] = useState<
    'idle' | 'picking-style' | 'picking-token' | 'confirming'
  >('idle');
  const [sourceStyle, setSourceStyle] = useState<TextStyle | null>(null);
  const [targetStyle, setTargetStyle] = useState<TextStyle | null>(null);
  const [sourceToken, setSourceToken] = useState<DesignToken | null>(null);
  const [targetToken, setTargetToken] = useState<DesignToken | null>(null);
  const [replacementType, setReplacementType] = useState<'style' | 'token' | null>(null);
  const [affectedLayerIds, setAffectedLayerIds] = useState<string[]>([]);

  // New slide-over panel state for style replacement
  const [showReplacementPanel, setShowReplacementPanel] = useState(false);
  const [replacementPanelError, setReplacementPanelError] = useState<string | undefined>();
  const [replacedStyleIds, setReplacedStyleIds] = useState<Set<string>>(new Set());
  // Track replacement mapping: original style ID -> { targetStyleId, targetStyleName, count }
  const [replacementHistory, setReplacementHistory] = useState<
    Map<string, { targetStyleId: string; targetStyleName: string; count: number }>
  >(new Map());

  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'loading';
  } | null>(null);

  // Get message handlers for communication with main context
  const { runStyleAudit, navigateToLayer, replaceStyle, replaceToken } = useMessageHandler();

  // Get audit state
  const {
    styleGovernanceResult,
    isAuditing,
    progress,
    error,
    reset,
    setStyleGovernanceResult,
    transitionTo,
    auditState,
    currentStep,
  } = useAuditState();

  // Calculate badge counts from audit results
  const styleBadgeCount = styleGovernanceResult?.styles.length ?? 0;
  const tokenBadgeCount = styleGovernanceResult?.tokens.length ?? 0;

  // Calculate which tabs should be disabled
  const disabledTabs: TabType[] = !styleGovernanceResult ? ['styles', 'tokens'] : [];

  // Auto-select first style when Styles tab is activated
  useEffect(() => {
    if (
      activeTab === 'styles' &&
      styleGovernanceResult &&
      styleGovernanceResult.styles.length > 0 &&
      !selectedStyle
    ) {
      setSelectedStyle(styleGovernanceResult.styles[0]);
    }
  }, [activeTab, styleGovernanceResult, selectedStyle]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRunAuditPage = () => {
    reset();
    // Immediately transition to validating state for instant visual feedback
    transitionTo('validating');
    runStyleAudit({ includeHiddenLayers: false, includeTokens: true });
  };

  const handleRunAuditSelection = () => {
    reset();
    // Immediately transition to validating state for instant visual feedback
    transitionTo('validating');
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
    setAffectedLayerIds(layerIds);
    setReplacementPanelError(undefined);
    setShowReplacementPanel(true);
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

  // New slide-over panel handlers
  const handleReplacementPanelClose = () => {
    setShowReplacementPanel(false);
    setReplacementPanelError(undefined);
  };

  // Optimistic update: Update audit results locally after replacement
  const updateAuditResultsAfterReplacement = (
    sourceStyleId: string,
    targetStyleId: string,
    affectedLayerIds: string[]
  ) => {
    if (!styleGovernanceResult) return;

    console.log('[UI] Optimistically updating audit results:', {
      sourceStyleId,
      targetStyleId,
      affectedLayerCount: affectedLayerIds.length,
    });

    // Clone the result to avoid mutation
    const updatedResult = { ...styleGovernanceResult };

    // Update styles array
    updatedResult.styles = styleGovernanceResult.styles.map((style) => {
      if (style.id === sourceStyleId) {
        // Decrement source style usage count
        return {
          ...style,
          usageCount: Math.max(0, style.usageCount - affectedLayerIds.length),
        };
      } else if (style.id === targetStyleId) {
        // Increment target style usage count
        return {
          ...style,
          usageCount: style.usageCount + affectedLayerIds.length,
        };
      }
      return style;
    });

    // Update layers array - change styleId for affected layers
    updatedResult.layers = styleGovernanceResult.layers.map((layer) => {
      if (affectedLayerIds.includes(layer.id) && layer.styleId === sourceStyleId) {
        // Find target style name and source
        const targetStyle = styleGovernanceResult.styles.find((s) => s.id === targetStyleId);
        return {
          ...layer,
          styleId: targetStyleId,
          styleName: targetStyle?.name || layer.styleName,
          styleSource: targetStyle?.libraryName || layer.styleSource,
        };
      }
      return layer;
    });

    // Update library sources if needed
    if (updatedResult.libraries) {
      updatedResult.libraries = styleGovernanceResult.libraries.map((lib) => {
        const sourceStyle = styleGovernanceResult.styles.find((s) => s.id === sourceStyleId);
        const targetStyle = styleGovernanceResult.styles.find((s) => s.id === targetStyleId);

        // If source style was from this library, decrement usage
        if (sourceStyle && sourceStyle.libraryName === lib.name) {
          return {
            ...lib,
            totalUsageCount: Math.max(0, lib.totalUsageCount - affectedLayerIds.length),
          };
        }
        // If target style is from this library, increment usage
        else if (targetStyle && targetStyle.libraryName === lib.name) {
          return {
            ...lib,
            totalUsageCount: lib.totalUsageCount + affectedLayerIds.length,
          };
        }
        return lib;
      });
    }

    // Apply the update
    setStyleGovernanceResult(updatedResult);

    console.log('[UI] Audit results updated optimistically');
  };

  const handleReplacementPanelReplace = async (source: TextStyle, target: TextStyle) => {
    console.log('[UI] Slide-over replacement:', {
      sourceStyleId: source.id,
      targetStyleId: target.id,
      affectedLayerCount: affectedLayerIds.length,
    });

    // Show loading toast
    setToast({ message: 'Replacing style...', type: 'loading' });

    try {
      await replaceStyle(source.id, target.id, affectedLayerIds);

      // Mark style as replaced (show green circle)
      setReplacedStyleIds((prev) => new Set(prev).add(source.id));

      // Track replacement in history (for showing replacement details)
      setReplacementHistory((prev) => {
        const newHistory = new Map(prev);
        const existingEntry = newHistory.get(source.id);
        newHistory.set(source.id, {
          targetStyleId: target.id,
          targetStyleName: target.name,
          count: (existingEntry?.count ?? 0) + affectedLayerIds.length,
        });
        return newHistory;
      });

      // Optimistically update audit results
      updateAuditResultsAfterReplacement(source.id, target.id, affectedLayerIds);

      // Show success toast
      setToast({
        message: `Successfully replaced "${source.name}" with "${target.name}"`,
        type: 'success',
      });

      // Close panel and reset state
      setShowReplacementPanel(false);
      setReplacementPanelError(undefined);
      setSourceStyle(null);
      setAffectedLayerIds([]);
    } catch (error) {
      // Show error and keep panel open
      const errorMessage = error instanceof Error ? error.message : 'Replacement failed';
      setReplacementPanelError(errorMessage);
      setShowReplacementPanel(true);
      setToast(null);
    }
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
      {/* Sidebar Navigation with Badge Counts */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        disabledTabs={disabledTabs}
        styleBadgeCount={styleBadgeCount}
        tokenBadgeCount={tokenBadgeCount}
      />

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
              <ProgressIndicator
                progress={progress}
                message={currentStep}
                state={auditState}
              />
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

                {/* Styles Tab - Filter Toolbar + 50/50 Split Layout */}
                {activeTab === 'styles' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Filter Toolbar */}
                    <FilterToolbar
                      type="styles"
                      searchQuery={stylesSearchQuery}
                      onSearchChange={setStylesSearchQuery}
                      sourceFilter={stylesSourceFilter}
                      onSourceFilterChange={setStylesSourceFilter}
                      groupByLibrary={stylesGroupByLibrary}
                      onGroupByLibraryChange={setStylesGroupByLibrary}
                    />

                    {/* 2-Column Layout */}
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                      {/* Left Panel - Style Tree (50%) */}
                      <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                        <StyleTreeView
                          styles={styleGovernanceResult.styles}
                          libraries={styleGovernanceResult.libraries}
                          unstyledLayers={styleGovernanceResult.unstyledLayers}
                          onStyleSelect={setSelectedStyle}
                          selectedStyleId={selectedStyle?.id}
                          replacedStyleIds={replacedStyleIds}
                          replacementHistory={replacementHistory}
                          searchQuery={stylesSearchQuery}
                          sourceFilter={stylesSourceFilter}
                          groupByLibrary={stylesGroupByLibrary}
                        />
                      </div>

                      {/* Visible Divider */}
                      <div
                        style={{
                          width: '1px',
                          backgroundColor: 'var(--figma-color-border)',
                          flexShrink: 0,
                        }}
                      />

                      {/* Right Panel - Detail Panel (50%) */}
                      <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                        {selectedStyle ? (
                          <DetailPanel
                            selectedStyle={selectedStyle}
                            allLayers={styleGovernanceResult.layers}
                            onNavigateToLayer={handleNavigateToLayer}
                            onReplaceStyle={handleReplaceStyle}
                            replacementHistory={replacementHistory}
                            allStyles={styleGovernanceResult.styles}
                          />
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '100%',
                              padding: 'var(--figma-space-lg)',
                            }}
                          >
                            <p
                              style={{
                                fontSize: '12px',
                                color: 'var(--figma-color-text-secondary)',
                                textAlign: 'center',
                              }}
                            >
                              Select a style to view its details
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tokens Tab - Filter Toolbar + 50/50 Split Layout */}
                {activeTab === 'tokens' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Filter Toolbar */}
                    <FilterToolbar
                      type="tokens"
                      searchQuery={tokensSearchQuery}
                      onSearchChange={setTokensSearchQuery}
                      searchPlaceholder="Search tokens..."
                      sourceFilter={tokensSourceFilter}
                      onSourceFilterChange={setTokensSourceFilter}
                      typeFilter={tokensTypeFilter}
                      onTypeFilterChange={setTokensTypeFilter}
                      availableTypes={Array.from(
                        new Set(styleGovernanceResult.tokens.map((t) => (t.type as string).toLowerCase()))
                      ).sort()}
                      groupByLibrary={tokensGroupByLibrary}
                      onGroupByLibraryChange={setTokensGroupByLibrary}
                    />

                    {/* 2-Column Layout */}
                    <div
                      style={{
                        display: 'flex',
                        flex: 1,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Left Panel - Token View (50%) */}
                      <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                        <TokenView
                          tokens={styleGovernanceResult.tokens}
                          allLayers={styleGovernanceResult.layers}
                          onTokenSelect={setSelectedToken}
                          selectedTokenId={selectedToken?.id}
                          searchQuery={tokensSearchQuery}
                          sourceFilter={tokensSourceFilter}
                          typeFilter={tokensTypeFilter}
                          groupByLibrary={tokensGroupByLibrary}
                        />
                      </div>

                    {/* Visible Divider */}
                    <div
                      style={{
                        width: '1px',
                        backgroundColor: 'var(--figma-color-border)',
                        flexShrink: 0,
                      }}
                    />

                    {/* Right Panel - Detail Panel (50%) */}
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      {selectedToken ? (
                        <DetailPanel
                          selectedToken={selectedToken}
                          allLayers={styleGovernanceResult.layers}
                          onNavigateToLayer={handleNavigateToLayer}
                          onReplaceToken={handleReplaceToken}
                          replacementHistory={replacementHistory}
                          allStyles={styleGovernanceResult.styles}
                        />
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            padding: 'var(--figma-space-lg)',
                          }}
                        >
                          <p
                            style={{
                              fontSize: '12px',
                              color: 'var(--figma-color-text-secondary)',
                              textAlign: 'center',
                            }}
                          >
                            Select a token to view its details
                          </p>
                        </div>
                      )}
                    </div>
                    </div>
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

      {/* Token Replacement Panel */}
      {styleGovernanceResult && replacementState === 'picking-token' && sourceToken && (
        <TokenReplacementPanel
          isOpen={replacementState === 'picking-token'}
          sourceToken={sourceToken}
          availableTokens={styleGovernanceResult.tokens}
          allLayers={styleGovernanceResult.layers}
          onClose={() => setReplacementState('idle')}
          onReplace={(source, target) => {
            setTargetToken(target);
            setReplacementState('confirming');
          }}
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

      {/* Style Replacement Slide-Over Panel */}
      {styleGovernanceResult && sourceStyle && (
        <StyleReplacementPanel
          isOpen={showReplacementPanel}
          sourceStyle={sourceStyle}
          availableStyles={styleGovernanceResult.styles}
          libraries={styleGovernanceResult.libraries}
          allLayers={styleGovernanceResult.layers}
          onClose={handleReplacementPanelClose}
          onReplace={handleReplacementPanelReplace}
          error={replacementPanelError}
          replacedStyleIds={replacedStyleIds}
        />
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={toast.type === 'loading' ? 0 : 3000}
        />
      )}
    </div>
  );
}

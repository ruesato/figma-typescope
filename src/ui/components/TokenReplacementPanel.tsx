import { useState, useMemo, useEffect } from 'react';
import ReplacementPanel from './ReplacementPanel';
import { TokenReplacementPreview } from './ReplacementPreview';
import TokenView from './TokenView';
import FilterToolbar from './FilterToolbar';
import ProgressIndicator from './ProgressIndicator';
import { useReplacementState } from '../hooks/useReplacementState';
import type { DesignToken, TextLayer } from '@/shared/types';

export interface TokenReplacementPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Source token being replaced */
  sourceToken: DesignToken;
  /** All available tokens to choose from */
  availableTokens: DesignToken[];
  /** All text layers (for TokenView compatibility and coverage calculation) */
  allLayers: TextLayer[];
  /** Layer IDs affected by this replacement (for progress tracking) */
  affectedLayerIds: string[];
  /** Callback when panel should close */
  onClose: () => void;
  /** Callback when replacement is confirmed */
  onReplace: (sourceToken: DesignToken, targetToken: DesignToken) => void;
  /** Optional error message to display at top of panel */
  error?: string;
}

/**
 * Token Replacement Panel Component
 *
 * Slide-over panel for selecting a target token to replace the source token.
 * Uses the generic ReplacementPanel component with TokenView for selection.
 *
 * Features:
 * - Source vs Target token preview with TokenMetadataCard
 * - Visual color swatches for COLOR tokens
 * - Multi-mode value display
 * - TokenView with collection grouping, search, and coverage filters
 * - Disabled Replace button until target selected
 * - Error banner support
 */
export default function TokenReplacementPanel({
  isOpen,
  sourceToken,
  availableTokens,
  allLayers,
  affectedLayerIds,
  onClose,
  onReplace,
  error,
}: TokenReplacementPanelProps) {
  const [selectedTargetToken, setSelectedTargetToken] = useState<DesignToken | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'library'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'color' | 'number' | 'string' | 'boolean'>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [groupByLibrary, setGroupByLibrary] = useState(true);

  // Get replacement state
  const replacementState = useReplacementState();
  const isReplacing = replacementState.isReplacing;

  // Don't auto-close when complete - let user review and manually close
  // useEffect(() => {
  //   if (replacementState.replacementState === 'complete') {
  //     // Auto-close panel after showing success briefly
  //     const timer = setTimeout(() => {
  //       replacementState.reset();
  //       onClose();
  //     }, 2000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [replacementState.replacementState]);

  // Get available token types
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    availableTokens.forEach((token) => {
      const type = (token.type as string).toLowerCase();
      types.add(type);
    });
    return Array.from(types).sort();
  }, [availableTokens]);

  // Handle replacement
  const handleReplace = () => {
    if (!selectedTargetToken) return;
    onReplace(sourceToken, selectedTargetToken);
    setSelectedTargetToken(null); // Reset selection
  };

  // Handle close/cancel
  const handleClose = () => {
    // If replacement is in progress, send cancel message
    if (isReplacing) {
      parent.postMessage(
        { pluginMessage: { type: 'CANCEL_REPLACEMENT' } },
        '*'
      );
      replacementState.reset();
    }

    setSelectedTargetToken(null); // Reset selection
    setSearchQuery(''); // Reset filters
    setSourceFilter('all');
    setTypeFilter('all');
    setUsageFilter('all');
    onClose();
  };

  // Show different content based on replacement state
  const isReplacingOrComplete = isReplacing || replacementState.replacementState === 'complete';

  return (
    <ReplacementPanel
      isOpen={isOpen}
      title={`Replace Token: ${sourceToken.name}`}
      description={
        replacementState.replacementState === 'complete'
          ? 'Replacement complete!'
          : isReplacing
          ? 'Replacement in progress...'
          : 'Select a target token from the list below'
      }
      error={error}
      previewSection={
        // Show preview during selection, hide during replacement/completion
        !isReplacingOrComplete ? (
          <TokenReplacementPreview source={sourceToken} target={selectedTargetToken} />
        ) : undefined
      }
      disableReplace={!selectedTargetToken || isReplacing}
      onClose={handleClose}
      onReplace={handleReplace}
      cancelLabel={replacementState.replacementState === 'complete' ? 'Close' : 'Cancel'}
      replaceLabel={isReplacing ? 'Replacing...' : 'Replace'}
    >
      {isReplacingOrComplete ? (
        // Show only progress indicator during replacement and after completion
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '48px 32px',
          }}
        >
          <ProgressIndicator
            progress={replacementState.progress}
            current={replacementState.layersProcessed}
            total={affectedLayerIds.length}
            message={
              replacementState.replacementState === 'validating'
                ? 'Validating document...'
                : replacementState.replacementState === 'creating_checkpoint'
                ? 'Creating version checkpoint...'
                : replacementState.replacementState === 'processing'
                ? 'Replacing tokens...'
                : replacementState.replacementState === 'complete'
                ? 'Complete!'
                : undefined
            }
            state={replacementState.replacementState}
          />

          {/* Show summary stats when complete */}
          {replacementState.replacementState === 'complete' && replacementState.result && (
            <div
              style={{
                marginTop: '32px',
                padding: '24px',
                backgroundColor: 'var(--figma-color-bg-secondary)',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '500px',
              }}
            >
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--figma-color-text)',
                  marginBottom: '16px',
                }}
              >
                Summary
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--figma-color-text-secondary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Layers updated:</span>
                  <span style={{ fontWeight: 500, color: 'var(--figma-color-text)' }}>
                    {replacementState.result.layersUpdated}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Layers failed:</span>
                  <span
                    style={{
                      fontWeight: 500,
                      color:
                        replacementState.result.layersFailed > 0
                          ? 'var(--figma-color-text-danger)'
                          : 'var(--figma-color-text)',
                    }}
                  >
                    {replacementState.result.layersFailed}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Duration:</span>
                  <span style={{ fontWeight: 500, color: 'var(--figma-color-text)' }}>
                    {(replacementState.result.duration / 1000).toFixed(1)}s
                  </span>
                </div>
                {replacementState.result.checkpointTitle && (
                  <div
                    style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--figma-color-border)',
                      fontSize: '11px',
                    }}
                  >
                    <span>Version checkpoint: </span>
                    <span style={{ fontWeight: 500 }}>{replacementState.result.checkpointTitle}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Show token selection UI when not replacing
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '0 16px' }}>
            <FilterToolbar
              type="tokens"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search tokens..."
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              availableTypes={availableTypes}
              usageFilter={usageFilter}
              onUsageFilterChange={setUsageFilter}
              groupByLibrary={groupByLibrary}
              onGroupByLibraryChange={setGroupByLibrary}
            />
          </div>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <TokenView
              tokens={availableTokens}
              allLayers={allLayers}
              onTokenSelect={setSelectedTargetToken}
              selectedTokenId={selectedTargetToken?.id}
              searchQuery={searchQuery}
              sourceFilter={sourceFilter}
              typeFilter={typeFilter}
              usageFilter={usageFilter}
              groupByLibrary={groupByLibrary}
            />
          </div>
        </div>
      )}
    </ReplacementPanel>
  );
}

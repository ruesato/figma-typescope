import { useState } from 'react';
import ReplacementPanel from './ReplacementPanel';
import { TokenReplacementPreview } from './ReplacementPreview';
import TokenView from './TokenView';
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
  onClose,
  onReplace,
  error,
}: TokenReplacementPanelProps) {
  const [selectedTargetToken, setSelectedTargetToken] = useState<DesignToken | null>(null);

  // Handle replacement
  const handleReplace = () => {
    if (!selectedTargetToken) return;
    onReplace(sourceToken, selectedTargetToken);
    setSelectedTargetToken(null); // Reset selection
  };

  // Handle close
  const handleClose = () => {
    setSelectedTargetToken(null); // Reset selection
    onClose();
  };

  return (
    <ReplacementPanel
      isOpen={isOpen}
      title={`Replace Token: ${sourceToken.name}`}
      description="Select a target token from the list below"
      error={error}
      previewSection={
        <TokenReplacementPreview
          source={sourceToken}
          target={selectedTargetToken}
        />
      }
      disableReplace={!selectedTargetToken}
      onClose={handleClose}
      onReplace={handleReplace}
      cancelLabel="Cancel"
      replaceLabel="Replace"
    >
      <TokenView
        tokens={availableTokens}
        allLayers={allLayers}
        onTokenSelect={setSelectedTargetToken}
        selectedTokenId={selectedTargetToken?.id}
      />
    </ReplacementPanel>
  );
}

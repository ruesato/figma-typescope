import { useState } from 'react';
import ReplacementPanel from './ReplacementPanel';
import { StyleReplacementPreview } from './ReplacementPreview';
import StyleTreeView from './StyleTreeView';
import FilterToolbar from './FilterToolbar';
import type { TextStyle, LibrarySource, TextLayer } from '@/shared/types';

export interface StyleReplacementPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Source style being replaced */
  sourceStyle: TextStyle;
  /** All available styles to choose from */
  availableStyles: TextStyle[];
  /** Library sources */
  libraries: LibrarySource[];
  /** All text layers (for StyleTreeView compatibility) */
  allLayers: TextLayer[];
  /** Callback when panel should close */
  onClose: () => void;
  /** Callback when replacement is confirmed */
  onReplace: (sourceStyle: TextStyle, targetStyle: TextStyle) => void;
  /** Optional error message to display at top of panel */
  error?: string;
  /** IDs of styles that have been replaced (for green circle indicator) */
  replacedStyleIds?: Set<string>;
}

/**
 * Style Replacement Panel Component
 *
 * Slide-over panel for selecting a target style to replace the source style.
 * Uses the generic ReplacementPanel component with StyleTreeView for selection.
 *
 * Features:
 * - Source vs Target style preview
 * - StyleTreeView with library grouping and filtering
 * - Disabled Replace button until target selected
 * - Error banner support
 */
export default function StyleReplacementPanel({
  isOpen,
  sourceStyle,
  availableStyles,
  libraries,
  allLayers,
  onClose,
  onReplace,
  error,
  replacedStyleIds,
}: StyleReplacementPanelProps) {
  const [selectedTargetStyle, setSelectedTargetStyle] = useState<TextStyle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'local' | 'library'>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [groupByLibrary, setGroupByLibrary] = useState(true);

  // Handle replacement
  const handleReplace = () => {
    if (!selectedTargetStyle) return;
    onReplace(sourceStyle, selectedTargetStyle);
    setSelectedTargetStyle(null); // Reset selection
  };

  // Handle close
  const handleClose = () => {
    setSelectedTargetStyle(null); // Reset selection
    setSearchQuery(''); // Reset filters
    setSourceFilter('all');
    setUsageFilter('all');
    onClose();
  };

  return (
    <ReplacementPanel
      isOpen={isOpen}
      title={`Replace Style: ${sourceStyle.name}`}
      description="Select a target style from the list below"
      error={error}
      previewSection={
        <StyleReplacementPreview
          source={sourceStyle}
          target={selectedTargetStyle}
        />
      }
      disableReplace={!selectedTargetStyle}
      onClose={handleClose}
      onReplace={handleReplace}
      cancelLabel="Cancel"
      replaceLabel="Replace"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '0 16px' }}>
          <FilterToolbar
            type="styles"
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search styles..."
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            usageFilter={usageFilter}
            onUsageFilterChange={setUsageFilter}
            groupByLibrary={groupByLibrary}
            onGroupByLibraryChange={setGroupByLibrary}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <StyleTreeView
            styles={availableStyles}
            libraries={libraries}
            unstyledLayers={[]} // Not showing unstyled layers in replacement panel
            onStyleSelect={setSelectedTargetStyle}
            selectedStyleId={selectedTargetStyle?.id}
            disabledStyleId={sourceStyle.id} // Prevent selecting the same style
            allLayers={allLayers}
            replacedStyleIds={replacedStyleIds}
            searchQuery={searchQuery}
            sourceFilter={sourceFilter}
            usageFilter={usageFilter}
            groupByLibrary={groupByLibrary}
          />
        </div>
      </div>
    </ReplacementPanel>
  );
}

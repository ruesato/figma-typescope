import { useState, useMemo } from 'react';
import ReplacementPanel from './ReplacementPanel';
import ConversionStyleTree from './ConversionStyleTree';
import PropertyOverridesForm from './PropertyOverridesForm';
import type { TextStyle, LibrarySource, DesignToken, PropertyOverrideMap } from '@/shared/types';

export interface ConversionPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** All text styles (will be filtered to show only remote) */
  styles: TextStyle[];
  /** Library sources */
  libraries: LibrarySource[];
  /** All available tokens */
  tokens: DesignToken[];
  /** Callback when panel should close */
  onClose: () => void;
  /** Callback when conversion is confirmed */
  onConvert: (sourceStyleIds: string[], propertyOverrides: PropertyOverrideMap) => void;
  /** Optional error message to display at top */
  error?: string;
}

/**
 * Conversion Panel Component
 *
 * Slide-over panel for converting remote text styles to local styles
 * with optional property overrides.
 *
 * Features:
 * - 2-column layout: Style selection (left) + Property overrides (right)
 * - ConversionStyleTree: Multi-select remote styles with checkboxes
 * - PropertyOverridesForm: Optional property overrides (manual or token)
 * - All remote styles selected by default
 * - Disabled Convert button until at least one style selected
 * - Error banner support
 */
export default function ConversionPanel({
  isOpen,
  styles,
  libraries,
  tokens,
  onClose,
  onConvert,
  error,
}: ConversionPanelProps) {
  // Get all remote style IDs for default selection
  const remoteStyleIds = useMemo(() => {
    return new Set(styles.filter((s) => s.sourceType !== 'local').map((s) => s.id));
  }, [styles]);

  const [selectedStyleIds, setSelectedStyleIds] = useState<Set<string>>(remoteStyleIds);
  const [propertyOverrides, setPropertyOverrides] = useState<PropertyOverrideMap>({});

  // Reset selections when panel opens
  useState(() => {
    if (isOpen) {
      setSelectedStyleIds(remoteStyleIds);
      setPropertyOverrides({});
    }
  });

  // Handle conversion
  const handleConvert = () => {
    if (selectedStyleIds.size === 0) return;
    onConvert(Array.from(selectedStyleIds), propertyOverrides);
  };

  // Handle close
  const handleClose = () => {
    setSelectedStyleIds(new Set());
    setPropertyOverrides({});
    onClose();
  };

  // Count remote styles
  const remoteStyleCount = useMemo(() => {
    return styles.filter((s) => s.sourceType !== 'local').length;
  }, [styles]);

  return (
    <ReplacementPanel
      isOpen={isOpen}
      title="Convert to Local Styles"
      description={
        selectedStyleIds.size > 0
          ? `${selectedStyleIds.size} of ${remoteStyleCount} remote styles selected for conversion`
          : 'Select remote styles to convert to local styles'
      }
      error={error}
      disableReplace={selectedStyleIds.size === 0}
      onClose={handleClose}
      onReplace={handleConvert}
      cancelLabel="Cancel"
      replaceLabel="Convert"
    >
      {/* 2-column layout */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Left: Style Selection Tree */}
        <div
          style={{
            flex: 1,
            borderRight: '1px solid var(--figma-color-border)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ConversionStyleTree
            styles={styles}
            libraries={libraries}
            selectedStyleIds={selectedStyleIds}
            onSelectionChange={setSelectedStyleIds}
          />
        </div>

        {/* Right: Property Overrides */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PropertyOverridesForm
            tokens={tokens}
            overrides={propertyOverrides}
            onOverridesChange={setPropertyOverrides}
          />
        </div>
      </div>
    </ReplacementPanel>
  );
}

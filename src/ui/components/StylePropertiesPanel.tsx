import React from 'react';
import type { TextStyle } from '@/shared/types';
import { TokenBadgeList } from './TokenBadge';

/**
 * StylePropertiesPanel Component Props
 */
interface StylePropertiesPanelProps {
  /** The text style to display properties for */
  style: TextStyle;
}

/**
 * StylePropertiesPanel Component
 *
 * Displays the base properties of a text style at the top of the DetailPanel.
 * Shows font properties (family, size, weight, line height, letter spacing, color)
 * and any design tokens applied to the style.
 *
 * @example
 * <StylePropertiesPanel style={selectedStyle} />
 */
export const StylePropertiesPanel: React.FC<StylePropertiesPanelProps> = ({ style }) => {
  // Format line height for display
  const formatLineHeight = (lineHeight: any): string => {
    if (!lineHeight) return 'AUTO';
    if (lineHeight.unit === 'AUTO') return 'AUTO';
    return lineHeight.unit === 'PERCENT' ? `${lineHeight.value}%` : `${lineHeight.value}px`;
  };

  // Format letter spacing for display
  const formatLetterSpacing = (letterSpacing: any): string => {
    if (!letterSpacing) return '0px';
    return letterSpacing.unit === 'PERCENT'
      ? `${letterSpacing.value}%`
      : `${letterSpacing.value}px`;
  };

  // Format color for display
  const formatColor = (fills: any[]): { display: string; hex: string } => {
    if (!fills || fills.length === 0) {
      return { display: 'No fill', hex: '#000000' };
    }

    const fill = fills[0];
    const r = Math.round(fill.r * 255);
    const g = Math.round(fill.g * 255);
    const b = Math.round(fill.b * 255);
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    if (fill.a < 1) {
      return { display: `rgba(${r}, ${g}, ${b}, ${fill.a.toFixed(2)})`, hex };
    }

    return { display: hex, hex };
  };

  const color = formatColor(style.fills);

  return (
    <div className="p-4 bg-gray-50 border-b border-gray-200">
      {/* Style Name Header */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{style.name}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{style.libraryName}</p>
      </div>

      {/* Properties Grid */}
      <div className="space-y-2">
        {/* Font Family */}
        <PropertyRow label="Font Family" value={style.fontFamily} />

        {/* Font Size */}
        <PropertyRow label="Size" value={`${style.fontSize}px`} />

        {/* Font Weight */}
        <PropertyRow label="Weight" value={String(style.fontWeight)} />

        {/* Line Height */}
        <PropertyRow label="Line Height" value={formatLineHeight(style.lineHeight)} />

        {/* Letter Spacing */}
        <PropertyRow label="Letter Spacing" value={formatLetterSpacing(style.letterSpacing)} />

        {/* Color */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 font-medium">Color</span>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
              style={{ backgroundColor: color.hex }}
              title={color.display}
            />
            <span className="text-gray-900 font-mono">{color.display}</span>
          </div>
        </div>
      </div>

      {/* Token Badges */}
      {style.tokens && style.tokens.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600 font-medium mb-2">Design Tokens</div>
          <TokenBadgeList tokens={style.tokens} mode="expanded" size="sm" />
        </div>
      )}
    </div>
  );
};

/**
 * PropertyRow Component
 * Displays a single property row with label and value
 */
interface PropertyRowProps {
  label: string;
  value: string;
}

const PropertyRow: React.FC<PropertyRowProps> = ({ label, value }) => {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-600 font-medium">{label}</span>
      <span className="text-gray-900 font-mono">{value}</span>
    </div>
  );
};

export default StylePropertiesPanel;

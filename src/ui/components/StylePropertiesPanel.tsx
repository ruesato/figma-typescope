import React from 'react';
import type { TextStyle, TokenBinding } from '@/shared/types';
import { TokenBadge, TokenBadgeList } from './TokenBadge';

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
  // Get tokens for a specific property
  const getTokensForProperty = (property: TokenBinding['property']): TokenBinding[] => {
    return (style.tokens || []).filter((token) => token.property === property);
  };

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
    <div className="layerStyles">
      {/* Style Name Header */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-figma-text">{style.name}</h3>
        <p className="text-xs text-figma-text-tertiary mt-0.5">{style.libraryName}</p>
      </div>

      {/* Properties Grid */}
      <div className="space-y-2">
        {/* Font Family */}
        <PropertyRow label="Font Family" value={style.fontFamily} tokens={getTokensForProperty('fontFamily')} />

        {/* Font Size */}
        <PropertyRow label="Size" value={`${style.fontSize}px`} tokens={getTokensForProperty('fontSize')} />

        {/* Font Weight */}
        <PropertyRow label="Weight" value={String(style.fontWeight)} tokens={[]} />

        {/* Line Height */}
        <PropertyRow label="Line Height" value={formatLineHeight(style.lineHeight)} tokens={getTokensForProperty('lineHeight')} />

        {/* Letter Spacing */}
        <PropertyRow label="Letter Spacing" value={formatLetterSpacing(style.letterSpacing)} tokens={getTokensForProperty('letterSpacing')} />

        {/* Color */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-figma-text-secondary font-medium">Color</span>
          <div className="flex items-center gap-2">
            {getTokensForProperty('fills').length > 0 ? (
              <div className="flex flex-wrap gap-1 justify-end">
                {getTokensForProperty('fills').map((token, idx) => (
                  <TokenBadge key={idx} token={token} mode="expanded" size="sm" />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-figma-border flex-shrink-0"
                  style={{ backgroundColor: color.hex }}
                  title={color.display}
                />
                <span className="text-figma-text font-mono">{color.display}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PropertyRow Component
 * Displays a single property row with label and value, with optional token badges
 */
interface PropertyRowProps {
  label: string;
  value: string;
  tokens?: TokenBinding[];
}

const PropertyRow: React.FC<PropertyRowProps> = ({ label, value, tokens = [] }) => {
  return (
    <div className="flex items-center justify-between text-xs gap-2">
      <span className="text-figma-text-secondary font-medium">{label}</span>
      {tokens.length > 0 ? (
        <div className="flex flex-wrap gap-1 justify-end">
          {tokens.map((token, idx) => (
            <TokenBadge key={idx} token={token} mode="expanded" size="sm" />
          ))}
        </div>
      ) : (
        <span className="text-figma-text font-mono">{value}</span>
      )}
    </div>
  );
};

export default StylePropertiesPanel;

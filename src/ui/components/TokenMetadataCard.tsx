import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DesignToken } from '@/shared/types';

interface TokenMetadataCardProps {
  token: DesignToken;
}

/**
 * Token Metadata Card Component
 *
 * Displays detailed token information including:
 * - Visual color swatch for COLOR tokens
 * - Type and collection metadata
 * - Current value with proper formatting
 * - Multi-mode values (expandable)
 * - Alias chain (if aliased token)
 *
 * Part of Token Details View enhancement sidequest
 */
export default function TokenMetadataCard({ token }: TokenMetadataCardProps) {
  const [showAllModes, setShowAllModes] = useState(false);

  // Format token value for display
  const formatValue = (value: any, type: string): { display: string; color?: string } => {
    if (value === null || value === undefined) {
      return { display: '—' };
    }

    // Handle COLOR type - RGB object (case-insensitive)
    if (type.toLowerCase() === 'color' && typeof value === 'object' && 'r' in value) {
      const r = Math.round(value.r * 255);
      const g = Math.round(value.g * 255);
      const b = Math.round(value.b * 255);
      const a = value.a !== undefined ? value.a : 1;

      return {
        display: `RGBA(${r}, ${g}, ${b}, ${a})`,
        color: `rgba(${r}, ${g}, ${b}, ${a})`,
      };
    }

    // Handle string values
    if (typeof value === 'string') {
      return { display: value.length > 50 ? value.substring(0, 50) + '...' : value };
    }

    // Handle numeric values
    if (typeof value === 'number') {
      return { display: String(value) };
    }

    // Handle boolean values
    if (typeof value === 'boolean') {
      return { display: value ? 'true' : 'false' };
    }

    return { display: JSON.stringify(value) };
  };

  const currentValueFormatted = formatValue(token.currentValue, token.type);
  const hasMultipleModes = token.modes && Object.keys(token.modes).length > 1;

  // Get type badge color
  const getTypeColor = (): string => {
    switch (token.type?.toUpperCase()) {
      case 'COLOR':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
      case 'STRING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      case 'FLOAT':
      case 'NUMBER':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200';
      case 'BOOLEAN':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div
      style={{
        padding: 'var(--figma-space-md)',
        backgroundColor: 'var(--figma-color-bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--figma-color-border)',
      }}
    >
      {/* Header with Type Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span
          className={`text-xs px-2 py-1 rounded font-medium ${getTypeColor()}`}
          style={{ textTransform: 'uppercase' }}
        >
          {String(token.type)}
        </span>
        {token.collectionName && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--figma-color-text-tertiary)',
            }}
          >
            {token.collectionName}
          </span>
        )}
      </div>

      {/* Current Value with Visual Preview */}
      <div style={{ marginBottom: hasMultipleModes ? '12px' : '0' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--figma-color-text-secondary)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Value
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Color Swatch for COLOR tokens */}
          {token.type.toLowerCase() === 'color' && currentValueFormatted.color && (
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '6px',
                backgroundColor: currentValueFormatted.color,
                border: '1px solid var(--figma-color-border)',
                flexShrink: 0,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
              }}
              title={currentValueFormatted.display}
            />
          )}

          {/* Value Text */}
          <div
            style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '12px',
              color: 'var(--figma-color-text)',
              backgroundColor: 'var(--figma-color-bg)',
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid var(--figma-color-border)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentValueFormatted.display}
          </div>
        </div>
      </div>

      {/* Multi-Mode Values */}
      {hasMultipleModes && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--figma-color-border)' }}>
          <button
            onClick={() => setShowAllModes(!showAllModes)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
              padding: '6px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--figma-color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {showAllModes ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Modes ({Object.keys(token.modes!).length})
          </button>

          {showAllModes && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(token.modes!).map(([modeName, modeValue]) => {
                const formatted = formatValue(modeValue, token.type);
                return (
                  <div
                    key={modeName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      backgroundColor: 'var(--figma-color-bg)',
                      borderRadius: '4px',
                      border: '1px solid var(--figma-color-border)',
                    }}
                  >
                    {/* Mode Color Swatch */}
                    {token.type.toLowerCase() === 'color' && formatted.color && (
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          backgroundColor: formatted.color,
                          border: '1px solid var(--figma-color-border)',
                          flexShrink: 0,
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                        }}
                      />
                    )}

                    {/* Mode Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          color: 'var(--figma-color-text)',
                          marginBottom: '2px',
                        }}
                      >
                        {modeName}
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          fontFamily: 'monospace',
                          color: 'var(--figma-color-text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatted.display}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Usage Statistics */}
      {token.usageCount !== undefined && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--figma-color-border)',
            fontSize: '11px',
            color: 'var(--figma-color-text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 600, color: 'var(--figma-color-text)' }}>
              {String(token.usageCount ?? 0)}
            </span>
            <span>usage{(token.usageCount ?? 0) !== 1 ? 's' : ''} in document</span>
          </div>
        </div>
      )}
    </div>
  );
}

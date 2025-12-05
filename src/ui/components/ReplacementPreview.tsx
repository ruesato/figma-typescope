import { ArrowRight } from 'lucide-react';
import type { TextStyle, DesignToken } from '@/shared/types';
import TokenMetadataCard from './TokenMetadataCard';

interface StylePreviewProps {
  source: TextStyle;
  target: TextStyle | null;
}

interface TokenPreviewProps {
  source: DesignToken;
  target: DesignToken | null;
}

/**
 * Style Replacement Preview
 *
 * Shows source style → target style comparison
 */
export function StyleReplacementPreview({ source, target }: StylePreviewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--figma-color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Preview
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Source Style */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: 'var(--figma-color-text-tertiary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            From
          </div>
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--figma-color-bg)',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '6px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--figma-color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={source.name}
            >
              {source.name}
            </div>
            {source.libraryName && (
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--figma-color-text-tertiary)',
                  marginTop: '2px',
                }}
              >
                {source.libraryName}
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight
          size={16}
          style={{
            color: 'var(--figma-color-text-tertiary)',
            flexShrink: 0,
          }}
        />

        {/* Target Style */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: 'var(--figma-color-text-tertiary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            To
          </div>
          {target ? (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--figma-color-bg-brand)',
                border: '1px solid var(--figma-color-bg-brand)',
                borderRadius: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--figma-color-text-onbrand)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={target.name}
              >
                {target.name}
              </div>
              {target.libraryName && (
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--figma-color-text-onbrand)',
                    opacity: 0.8,
                    marginTop: '2px',
                  }}
                >
                  {target.libraryName}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--figma-color-bg)',
                border: '1px dashed var(--figma-color-border)',
                borderRadius: '6px',
                color: 'var(--figma-color-text-tertiary)',
                fontSize: '11px',
                fontStyle: 'italic',
                textAlign: 'center',
              }}
            >
              Select a target
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Token Replacement Preview
 *
 * Shows source token → target token comparison with metadata cards
 */
export function TokenReplacementPreview({ source, target }: TokenPreviewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--figma-color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Preview
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Source Token */}
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: 'var(--figma-color-text-tertiary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            From
          </div>
          <TokenMetadataCard token={source} />
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              backgroundColor: 'var(--figma-color-bg)',
              border: '1px solid var(--figma-color-border)',
              borderRadius: '12px',
            }}
          >
            <ArrowRight size={14} style={{ color: 'var(--figma-color-text-tertiary)' }} />
            <span style={{ fontSize: '10px', color: 'var(--figma-color-text-secondary)' }}>
              Replace with
            </span>
          </div>
        </div>

        {/* Target Token */}
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: 'var(--figma-color-text-tertiary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            To
          </div>
          {target ? (
            <TokenMetadataCard token={target} />
          ) : (
            <div
              style={{
                padding: '24px',
                backgroundColor: 'var(--figma-color-bg)',
                border: '1px dashed var(--figma-color-border)',
                borderRadius: '8px',
                color: 'var(--figma-color-text-tertiary)',
                fontSize: '11px',
                fontStyle: 'italic',
                textAlign: 'center',
              }}
            >
              Select a target token from the list below
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import type { TokenBinding } from '@/shared/types';
import { formatTokenValue, getPropertyLabel } from '@/ui/utils/tokenFormatters';

/**
 * TokenBadge Component Props
 */
interface TokenBadgeProps {
  /** Token binding data */
  token: TokenBinding;
  /** Display mode: compact (name only) or expanded (name + value) */
  mode?: 'compact' | 'expanded';
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * TokenBadge Component
 *
 * Displays a single design token with its property, name, and value.
 * Supports color swatches for fill tokens.
 *
 * @example
 * <TokenBadge
 *   token={{ property: 'fills', tokenName: 'primary', tokenValue: { r: 0, g: 0, b: 1, a: 1 } }}
 *   mode="expanded"
 * />
 */
export const TokenBadge: React.FC<TokenBadgeProps> = ({
  token,
  mode = 'expanded',
  size = 'sm',
}) => {
  const formatted = formatTokenValue(token.tokenValue, token.property);
  const propertyLabel = getPropertyLabel(token.property);

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
  };

  // Property color coding
  const propertyColors: Record<TokenBinding['property'], string> = {
    fills: 'bg-purple-100 text-purple-800',
    fontFamily: 'bg-blue-100 text-blue-800',
    fontSize: 'bg-green-100 text-green-800',
    lineHeight: 'bg-yellow-100 text-yellow-800',
    letterSpacing: 'bg-pink-100 text-pink-800',
  };

  const colorClass = propertyColors[token.property];

  return (
    <div className={`inline-flex items-center gap-1.5 rounded ${colorClass} ${sizeClasses[size]}`}>
      {/* Color swatch for fill tokens */}
      {token.property === 'fills' && formatted.color && (
        <div
          className="w-3 h-3 rounded border border-gray-300 flex-shrink-0"
          style={{ backgroundColor: formatted.color }}
          title={formatted.display}
        />
      )}

      {/* Property label (for expanded mode) */}
      {mode === 'expanded' && (
        <span className="font-medium opacity-75 text-[10px] uppercase tracking-wide">
          {propertyLabel}
        </span>
      )}

      {/* Token name */}
      <span className="font-medium truncate max-w-[120px]" title={token.tokenName}>
        {token.tokenName}
      </span>

      {/* Token value (for expanded mode, non-fill tokens) */}
      {mode === 'expanded' && token.property !== 'fills' && (
        <span className="opacity-75 font-mono text-[10px]" title={formatted.display}>
          {formatted.display}
        </span>
      )}
    </div>
  );
};

/**
 * TokenBadgeList Component
 *
 * Displays a list of token badges with wrapping and spacing
 *
 * @example
 * <TokenBadgeList
 *   tokens={layer.tokens}
 *   maxVisible={3}
 *   mode="expanded"
 * />
 */
interface TokenBadgeListProps {
  /** Array of token bindings */
  tokens: TokenBinding[];
  /** Maximum number of tokens to show before collapsing */
  maxVisible?: number;
  /** Display mode */
  mode?: 'compact' | 'expanded';
  /** Size variant */
  size?: 'sm' | 'md';
}

export const TokenBadgeList: React.FC<TokenBadgeListProps> = ({
  tokens,
  maxVisible,
  mode = 'expanded',
  size = 'sm',
}) => {
  const [showAll, setShowAll] = React.useState(false);

  if (!tokens || tokens.length === 0) {
    return null;
  }

  const visibleTokens = maxVisible && !showAll ? tokens.slice(0, maxVisible) : tokens;
  const hasMore = maxVisible && tokens.length > maxVisible && !showAll;

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {visibleTokens.map((token, index) => (
        <TokenBadge
          key={`${token.property}-${token.tokenId}-${index}`}
          token={token}
          mode={mode}
          size={size}
        />
      ))}

      {/* Show more button */}
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          +{tokens.length - maxVisible} more
        </button>
      )}

      {/* Show less button */}
      {showAll && maxVisible && tokens.length > maxVisible && (
        <button
          onClick={() => setShowAll(false)}
          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
};

export default TokenBadge;

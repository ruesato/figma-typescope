/**
 * Token Value Formatting Utilities
 *
 * Shared utilities for formatting and displaying design token values
 * across different components (DetailPanel, TokenMetadataCard, etc.)
 */

/**
 * Result of formatting a token value
 */
export interface FormattedTokenValue {
  /** Human-readable display text */
  display: string;
  /** CSS color string (only for COLOR tokens) */
  color?: string;
}

/**
 * Format a token value for display based on its type
 *
 * @param value - Raw token value (RGB object, string, number, boolean, etc.)
 * @param property - Token property type (fills, fontFamily, fontSize, etc.)
 * @returns Formatted value with optional color string
 *
 * @example
 * formatTokenValue({ r: 0.5, g: 0.5, b: 0.5, a: 1 }, 'fills')
 * // { display: 'RGBA(128, 128, 128, 1)', color: 'rgba(128, 128, 128, 1)' }
 *
 * formatTokenValue('Inter', 'fontFamily')
 * // { display: 'Inter' }
 *
 * formatTokenValue(16, 'fontSize')
 * // { display: '16px' }
 */
export function formatTokenValue(
  value: any,
  property: 'fills' | 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'
): FormattedTokenValue {
  if (value === null || value === undefined) {
    return { display: '—' };
  }

  // Handle COLOR type (fills property) - RGB object
  if (property === 'fills' && typeof value === 'object' && 'r' in value) {
    const r = Math.round(value.r * 255);
    const g = Math.round(value.g * 255);
    const b = Math.round(value.b * 255);
    const a = value.a !== undefined ? value.a : 1;

    return {
      display: `RGBA(${r}, ${g}, ${b}, ${a})`,
      color: `rgba(${r}, ${g}, ${b}, ${a})`,
    };
  }

  // Handle fontFamily - display as-is
  if (property === 'fontFamily') {
    return { display: String(value) };
  }

  // Handle fontSize - add px suffix
  if (property === 'fontSize') {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    return { display: `${numValue}px` };
  }

  // Handle lineHeight - can be number or "AUTO"
  if (property === 'lineHeight') {
    if (typeof value === 'object' && 'value' in value) {
      if (value.unit === 'AUTO') return { display: 'Auto' };
      if (value.unit === 'PERCENT') return { display: `${value.value}%` };
      return { display: `${value.value}px` };
    }
    if (value === 'AUTO') return { display: 'Auto' };
    return { display: String(value) };
  }

  // Handle letterSpacing
  if (property === 'letterSpacing') {
    if (typeof value === 'object' && 'value' in value) {
      if (value.unit === 'PERCENT') return { display: `${value.value}%` };
      return { display: `${value.value}px` };
    }
    return { display: String(value) };
  }

  // Fallback for unknown types
  if (typeof value === 'object') {
    return { display: JSON.stringify(value) };
  }

  return { display: String(value) };
}

/**
 * Get human-readable label for token property
 *
 * @param property - Token property type
 * @returns Display label
 *
 * @example
 * getPropertyLabel('fills') // 'Fill'
 * getPropertyLabel('fontFamily') // 'Font'
 */
export function getPropertyLabel(
  property: 'fills' | 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'
): string {
  const labels: Record<typeof property, string> = {
    fills: 'Fill',
    fontFamily: 'Font',
    fontSize: 'Size',
    lineHeight: 'Line Height',
    letterSpacing: 'Spacing',
  };
  return labels[property];
}

/**
 * Get icon or emoji for token property type
 *
 * @param property - Token property type
 * @returns Emoji or icon string
 */
export function getPropertyIcon(
  property: 'fills' | 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'
): string {
  const icons: Record<typeof property, string> = {
    fills: '🎨',
    fontFamily: '🔤',
    fontSize: '📏',
    lineHeight: '📐',
    letterSpacing: '↔️',
  };
  return icons[property];
}

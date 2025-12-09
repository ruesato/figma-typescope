/**
 * Version Information Utility
 *
 * Provides version information for debugging and support.
 */

/**
 * Get plugin version from package.json
 * In production, this should be imported from package.json
 */
export function getPluginVersion(): string {
  // This will be replaced at build time with actual version from package.json
  const pkg = require('../../../package.json');
  return pkg.version || '1.0.0';
}

/**
 * Get debug information for support requests
 */
export function getDebugInfo(): {
  version: string;
  userAgent: string;
  timestamp: string;
} {
  return {
    version: getPluginVersion(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format debug info for display
 */
export function formatDebugInfo(): string {
  const info = getDebugInfo();
  return `Typescope v${info.version} | ${info.timestamp}`;
}

/**
 * Check if running in development mode
 */
export function isDevelopmentMode(): boolean {
  // Check for development environment indicators
  const version = getPluginVersion();
  return version.includes('-dev') || version.includes('-beta');
}

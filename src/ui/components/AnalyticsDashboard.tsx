import React, { useMemo } from 'react';
import type { AuditResult, StyleGovernanceAuditResult } from '@/shared/types';

interface AnalyticsDashboardProps {
  auditResult: AuditResult | StyleGovernanceAuditResult;
  isLoading?: boolean;
  error?: string;
}

/**
 * Animated Counter Component
 * Animates numeric values from 0 to final value using CSS animation
 */
function AnimatedCounter({
  value,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const displayValue = value.toFixed(decimals);

  return (
    <span
      className="inline-block animate-fadeInUp"
      style={{
        animation: 'fadeInUp 0.6s ease-out',
      }}
    >
      {displayValue}
      {suffix}
    </span>
  );
}

/**
 * Metric Card Component
 * Displays a single metric with animated counter
 */
function MetricCard({
  label,
  value,
  suffix = '',
  decimals = 0,
  icon,
  variant = 'default',
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantClasses = {
    default: 'border-figma-border',
    success: 'border-green-400',
    warning: 'border-yellow-400',
    danger: 'border-red-400',
  };

  return (
    <div
      className={`border rounded-lg p-4 bg-figma-bg-secondary ${variantClasses[variant]} animate-fadeInScale`}
      style={{
        animation: 'fadeInScale 0.4s ease-out',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-figma-text-secondary text-xs font-medium mb-2">{label}</p>
          <p className="text-2xl font-bold text-figma-text">
            <AnimatedCounter value={value} suffix={suffix} decimals={decimals} />
          </p>
        </div>
        {icon && <span className="text-2xl ml-2">{icon}</span>}
      </div>
    </div>
  );
}

/**
 * Skeleton Loader Component
 * Displays loading state for metric cards
 */
function MetricSkeleton() {
  return (
    <div className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-3 bg-figma-border rounded w-20 mb-3"></div>
          <div className="h-8 bg-figma-border rounded w-16"></div>
        </div>
        <div className="h-8 w-8 bg-figma-border rounded"></div>
      </div>
    </div>
  );
}

/**
 * Top Styles Table Component
 * Shows the 10 most used styles with adoption metrics
 */
function TopStylesTable({
  styles,
  totalLayers,
  isLoading = false,
}: {
  styles: Array<{
    styleName: string;
    libraryName: string;
    usageCount: number;
  }>;
  totalLayers: number;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-figma-border rounded animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto animate-fadeIn"
      style={{
        animation: 'fadeIn 0.5s ease-out 0.2s forwards',
        opacity: 0,
      }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-figma-border">
            <th className="text-left py-2 px-2 text-figma-text-secondary font-semibold text-xs">
              Style Name
            </th>
            <th className="text-left py-2 px-2 text-figma-text-secondary font-semibold text-xs">
              Library
            </th>
            <th className="text-right py-2 px-2 text-figma-text-secondary font-semibold text-xs">
              Usage
            </th>
            <th className="text-right py-2 px-2 text-figma-text-secondary font-semibold text-xs">
              Adoption
            </th>
          </tr>
        </thead>
        <tbody>
          {styles.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-4 text-figma-text-tertiary text-xs">
                No styles found
              </td>
            </tr>
          ) : (
            styles.slice(0, 10).map((style, index) => {
              const adoptionPercent = totalLayers
                ? ((style.usageCount / totalLayers) * 100).toFixed(1)
                : '0';

              return (
                <tr
                  key={`${style.styleName}-${index}`}
                  className="border-b border-figma-border hover:bg-figma-bg-tertiary transition-colors animate-fadeInLeft"
                  style={{
                    animation: `fadeInLeft 0.3s ease-out ${index * 0.05}s forwards`,
                    opacity: 0,
                  }}
                >
                  <td className="py-2 px-2 text-figma-text truncate">{style.styleName}</td>
                  <td className="py-2 px-2 text-figma-text-secondary text-xs truncate">
                    {style.libraryName}
                  </td>
                  <td className="py-2 px-2 text-right text-figma-text font-medium">
                    {style.usageCount}
                  </td>
                  <td className="py-2 px-2 text-right text-figma-text font-medium">
                    {adoptionPercent}%
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Library Distribution Card Component
 * Shows breakdown of styles by library
 */
function LibraryDistributionCard({
  distribution,
  isLoading = false,
}: {
  distribution: Record<string, number>;
  isLoading?: boolean;
}) {
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2 bg-figma-border rounded animate-pulse"
          >
            <div className="h-4 bg-figma-bg-tertiary rounded w-24"></div>
            <div className="h-4 bg-figma-bg-tertiary rounded w-12"></div>
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a);

  return (
    <div
      className="space-y-3 animate-fadeIn"
      style={{
        animation: 'fadeIn 0.5s ease-out 0.1s forwards',
        opacity: 0,
      }}
    >
      {entries.length === 0 ? (
        <p className="text-figma-text-tertiary text-xs text-center py-4">
          No library data available
        </p>
      ) : (
        entries.map(([libraryName, count], index) => {
          const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
          const barWidth = total > 0 ? (count / total) * 100 : 0;

          return (
            <div
              key={libraryName}
              className="animate-fadeInLeft"
              style={{
                animation: `fadeInLeft 0.3s ease-out ${index * 0.05}s forwards`,
                opacity: 0,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-figma-text text-xs font-medium truncate">{libraryName}</span>
                <span className="text-figma-text-secondary text-xs ml-2">{percentage}%</span>
              </div>
              <div className="w-full h-2 bg-figma-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-600"
                  style={{
                    width: `${barWidth}%`,
                    animation: `slideInRight 0.6s ease-out ${index * 0.05}s forwards`,
                  }}
                ></div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * Usage Comparison Card Component
 * Displays token vs style usage visualization
 */
function UsageComparisonCard({
  styleAdoptionRate,
  tokenCoverageRate,
  mixedUsageCount,
  totalLayers,
  isLoading = false,
}: {
  styleAdoptionRate: number;
  tokenCoverageRate: number;
  mixedUsageCount: number;
  totalLayers: number;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-figma-border rounded animate-pulse"></div>
        <div className="h-6 bg-figma-border rounded animate-pulse"></div>
        <div className="h-6 bg-figma-border rounded animate-pulse"></div>
      </div>
    );
  }

  const mixedUsagePercent =
    totalLayers > 0 ? ((mixedUsageCount / totalLayers) * 100).toFixed(1) : '0';

  return (
    <div
      className="space-y-4 animate-fadeIn"
      style={{
        animation: 'fadeIn 0.5s ease-out 0.15s forwards',
        opacity: 0,
      }}
    >
      {/* Style Usage Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-figma-text text-sm font-medium">Style Usage</span>
          <span className="text-figma-text font-semibold">{styleAdoptionRate.toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-figma-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-600"
            style={{
              width: `${styleAdoptionRate}%`,
              animation: 'slideInRight 0.6s ease-out forwards',
            }}
          ></div>
        </div>
      </div>

      {/* Token Usage Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-figma-text text-sm font-medium">Token Coverage</span>
          <span className="text-figma-text font-semibold">{tokenCoverageRate.toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-figma-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full transition-all duration-600"
            style={{
              width: `${tokenCoverageRate}%`,
              animation: 'slideInRight 0.6s ease-out 0.1s forwards',
            }}
          ></div>
        </div>
      </div>

      {/* Mixed Usage */}
      <div className="pt-2 border-t border-figma-border">
        <div className="flex items-center justify-between">
          <span className="text-figma-text-secondary text-sm">Mixed Usage</span>
          <span className="text-figma-text font-semibold">
            {mixedUsageCount} ({mixedUsagePercent}%)
          </span>
        </div>
        <p className="text-figma-text-tertiary text-xs mt-1">Layers using both styles and tokens</p>
      </div>
    </div>
  );
}

/**
 * Analytics Dashboard Component
 *
 * Displays key metrics and usage analytics for design system adoption.
 * Includes:
 * - 4 key metric cards with animated counters
 * - Top 10 most used styles table
 * - Library distribution breakdown
 * - Token vs style usage comparison
 *
 * @example
 * ```tsx
 * <AnalyticsDashboard
 *   auditResult={result}
 *   isLoading={false}
 * />
 * ```
 */

/**
 * Token Inventory Section Component
 * Displays total token count and breakdown by collection
 */
function TokenInventorySection({
  totalTokenCount,
  tokensByCollection,
  isLoading = false,
}: {
  totalTokenCount: number;
  tokensByCollection: Record<string, number>;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-pulse">
        <div className="h-6 bg-figma-border rounded w-32 mb-4"></div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 bg-figma-border rounded w-40"></div>
          ))}
        </div>
      </div>
    );
  }

  const collections = Object.entries(tokensByCollection).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-fadeInScale"
      style={{
        animation: 'fadeInScale 0.4s ease-out 0.2s forwards',
        opacity: 0,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🎨</span>
        <h3 className="text-sm font-semibold text-figma-text">Token Inventory</h3>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center p-2 bg-figma-bg rounded">
          <span className="text-xs text-figma-text-secondary">Total Tokens:</span>
          <span className="text-sm font-semibold text-figma-text">{totalTokenCount}</span>
        </div>

        {collections.length > 0 && (
          <>
            <div className="text-xs text-figma-text-secondary font-medium mt-3 mb-2">
              By Collection:
            </div>
            <div className="space-y-2">
              {collections.map(([collectionName, count]) => (
                <div
                  key={collectionName}
                  className="flex justify-between items-center p-2 bg-figma-bg rounded text-xs"
                >
                  <span className="text-figma-text-secondary">{collectionName}</span>
                  <span className="text-figma-text font-medium">{count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Token Coverage Breakdown Section Component
 * Shows layers categorized by token property coverage (full, partial, none)
 */
function TokenCoverageBreakdownSection({
  elementCount,
  fullTokenCoverageCount,
  fullTokenCoverageRate,
  partialTokenCoverageCount,
  partialTokenCoverageRate,
  noTokenCoverageCount,
  noTokenCoverageRate,
  isLoading = false,
}: {
  elementCount: number;
  fullTokenCoverageCount: number;
  fullTokenCoverageRate: number;
  partialTokenCoverageCount: number;
  partialTokenCoverageRate: number;
  noTokenCoverageCount: number;
  noTokenCoverageRate: number;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-pulse">
        <div className="h-6 bg-figma-border rounded w-32 mb-4"></div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 bg-figma-border rounded w-40"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-fadeInScale"
      style={{
        animation: 'fadeInScale 0.4s ease-out 0.3s forwards',
        opacity: 0,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📊</span>
        <h3 className="text-sm font-semibold text-figma-text">Token Coverage by Layer</h3>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center p-2 bg-figma-bg rounded">
          <span className="text-xs text-figma-text-secondary">Total Text Layers:</span>
          <span className="text-sm font-semibold text-figma-text">
            {elementCount.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center p-2 bg-green-500/10 rounded border border-green-500/20">
          <div className="flex flex-col">
            <span className="text-xs text-figma-text-secondary">Full Coverage</span>
            <span className="text-[10px] text-figma-text-tertiary">All 5 properties</span>
          </div>
          <span className="text-sm font-semibold text-green-600">
            {fullTokenCoverageCount.toLocaleString()} ({fullTokenCoverageRate}%)
          </span>
        </div>

        <div className="flex justify-between items-center p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
          <div className="flex flex-col">
            <span className="text-xs text-figma-text-secondary">Partial Coverage</span>
            <span className="text-[10px] text-figma-text-tertiary">1-4 properties</span>
          </div>
          <span className="text-sm font-semibold text-yellow-600">
            {partialTokenCoverageCount.toLocaleString()} ({partialTokenCoverageRate}%)
          </span>
        </div>

        <div className="flex justify-between items-center p-2 bg-red-500/10 rounded border border-red-500/20">
          <div className="flex flex-col">
            <span className="text-xs text-figma-text-secondary">No Coverage</span>
            <span className="text-[10px] text-figma-text-tertiary">0 properties</span>
          </div>
          <span className="text-sm font-semibold text-red-600">
            {noTokenCoverageCount.toLocaleString()} ({noTokenCoverageRate}%)
          </span>
        </div>

        {/* Stacked bar visualization */}
        <div className="mt-3 pt-3 border-t border-figma-border">
          <div className="flex h-2 rounded overflow-hidden gap-0.5 bg-figma-bg">
            <div
              className="bg-green-500 transition-all duration-300"
              style={{ width: `${fullTokenCoverageRate}%` }}
              title={`Full coverage: ${fullTokenCoverageRate}%`}
            ></div>
            <div
              className="bg-yellow-500 transition-all duration-300"
              style={{ width: `${partialTokenCoverageRate}%` }}
              title={`Partial coverage: ${partialTokenCoverageRate}%`}
            ></div>
            <div
              className="bg-red-500 transition-all duration-300"
              style={{ width: `${noTokenCoverageRate}%` }}
              title={`No coverage: ${noTokenCoverageRate}%`}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-figma-text-tertiary">
            <span>Full</span>
            <span>Partial</span>
            <span>None</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Token Usage Depth Section Component
 * Displays token binding counts and unused tokens
 */
function TokenUsageDepthSection({
  totalTokenBindings,
  elementsWithTokens,
  uniqueTokensUsed,
  totalTokenCount,
  unusedTokenCount,
  isLoading = false,
}: {
  totalTokenBindings: number;
  elementsWithTokens: number;
  uniqueTokensUsed: number;
  totalTokenCount: number;
  unusedTokenCount: number;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-pulse">
        <div className="h-6 bg-figma-border rounded w-32 mb-4"></div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 bg-figma-border rounded w-40"></div>
          ))}
        </div>
      </div>
    );
  }

  const avgBindingsPerLayer =
    elementsWithTokens > 0 ? (totalTokenBindings / elementsWithTokens).toFixed(1) : '0';
  const coveragePercent =
    totalTokenCount > 0 ? ((uniqueTokensUsed / totalTokenCount) * 100).toFixed(1) : '0';

  return (
    <div
      className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-fadeInScale"
      style={{
        animation: 'fadeInScale 0.4s ease-out 0.4s forwards',
        opacity: 0,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🔗</span>
        <h3 className="text-sm font-semibold text-figma-text">Token Usage Depth</h3>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center p-2 bg-figma-bg rounded">
          <span className="text-xs text-figma-text-secondary">Total Bindings:</span>
          <span className="text-sm font-semibold text-figma-text">
            {totalTokenBindings.toLocaleString()}
            <span className="text-xs text-figma-text-tertiary ml-1">
              ({avgBindingsPerLayer} per layer w/ tokens)
            </span>
          </span>
        </div>

        <div className="flex justify-between items-center p-2 bg-figma-bg rounded">
          <span className="text-xs text-figma-text-secondary">Unique Tokens Used:</span>
          <span className="text-sm font-semibold text-figma-text">
            {uniqueTokensUsed} of {totalTokenCount} ({coveragePercent}%)
          </span>
        </div>

        {unusedTokenCount > 0 && (
          <div className="flex justify-between items-center p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
            <span className="text-xs text-figma-text-secondary">Unused Tokens:</span>
            <span className="text-sm font-semibold text-yellow-700">{unusedTokenCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsDashboard({
  auditResult,
  isLoading = false,
  error,
}: AnalyticsDashboardProps) {
  // Calculate metrics from audit result
  const metrics = useMemo(() => {
    if (!auditResult) {
      return {
        styleAdoptionRate: 0,
        tokenAdoptionRate: 0,
        tokenCoverageRate: 0,
        libraryDistribution: {},
        topStyles: [],
        mixedUsageCount: 0,
        totalTokenCount: 0,
        uniqueTokensUsed: 0,
        unusedTokenCount: 0,
        totalTokenBindings: 0,
        tokensByCollection: {},
        elementCount: 0,
        elementsWithTokens: 0,
        elementsWithoutTokens: 0,
      };
    }

    // Handle both AuditResult and StyleGovernanceAuditResult types
    const isStyleGovernanceResult = 'metrics' in auditResult && 'layers' in auditResult;

    if (isStyleGovernanceResult) {
      // StyleGovernanceAuditResult format
      const result = auditResult as StyleGovernanceAuditResult;
      const metrics = result.metrics as any;
      const styleAdoptionRate = metrics.styleAdoptionRate || 0;
      const tokenAdoptionRate = metrics.tokenAdoptionRate || 0;
      const tokenCoverageRate = metrics.tokenCoverageRate || 0;
      const totalTokenCount = metrics.totalTokenCount || 0;
      const uniqueTokensUsed = metrics.uniqueTokensUsed || 0;
      const unusedTokenCount = metrics.unusedTokenCount || 0;
      const totalTokenBindings = metrics.totalTokenBindings || 0;
      const tokensByCollection = metrics.tokensByCollection || {};
      const elementCount = metrics.elementCount || 0;
      const elementsWithTokens = metrics.elementsWithTokens || 0;
      const elementsWithoutTokens = metrics.elementsWithoutTokens || 0;

      // Build library distribution from libraries array
      const libraryDistribution: Record<string, number> = {};
      result.libraries?.forEach((lib) => {
        libraryDistribution[lib.name] = lib.totalUsageCount || 0;
      });

      // Get top styles from metrics
      const topStyles = (result.metrics.topStyles || [])
        .map((s: any) => ({
          styleName: s.styleName || 'Unknown',
          libraryName: 'Local', // TODO: Get from styles array
          usageCount: s.usageCount || 0,
        }))
        .slice(0, 10);

      const mixedUsageCount = result.metrics.mixedUsageCount || 0;

      return {
        styleAdoptionRate,
        tokenAdoptionRate,
        tokenCoverageRate,
        libraryDistribution,
        topStyles,
        mixedUsageCount,
        totalTokenCount,
        uniqueTokensUsed,
        unusedTokenCount,
        totalTokenBindings,
        tokensByCollection,
        elementCount,
        elementsWithTokens,
        elementsWithoutTokens,
        fullTokenCoverageCount: metrics.fullTokenCoverageCount || 0,
        fullTokenCoverageRate: metrics.fullTokenCoverageRate || 0,
        partialTokenCoverageCount: metrics.partialTokenCoverageCount || 0,
        partialTokenCoverageRate: metrics.partialTokenCoverageRate || 0,
        noTokenCoverageCount: metrics.noTokenCoverageCount || 0,
        noTokenCoverageRate: metrics.noTokenCoverageRate || 0,
      };
    } else {
      // Legacy AuditResult format
      const result = auditResult as AuditResult;
      const textLayers = result.textLayers || [];

      const styledLayers = textLayers.filter(
        (layer: any) => layer.styleAssignment?.assignmentStatus !== 'unstyled'
      );
      const styleAdoptionRate =
        textLayers.length > 0 ? (styledLayers.length / textLayers.length) * 100 : 0;

      const tokenAdoptionRate = result.tokenAdoptionRate || 0;
      // Note: Legacy format doesn't have tokenCoverageRate, use 0 as default
      const tokenCoverageRate = 0;

      const libraryDistribution: Record<string, number> = {};
      textLayers.forEach((layer: any) => {
        const library = layer.styleAssignment?.libraryName || 'Local';
        libraryDistribution[library] = (libraryDistribution[library] || 0) + 1;
      });

      const styleUsageMap = new Map<string, { name: string; library: string; count: number }>();
      textLayers.forEach((layer: any) => {
        if (layer.styleAssignment?.styleName) {
          const key = layer.styleAssignment.styleName;
          const existing = styleUsageMap.get(key);
          styleUsageMap.set(key, {
            name: layer.styleAssignment.styleName,
            library: layer.styleAssignment.libraryName || 'Local',
            count: (existing?.count || 0) + 1,
          });
        }
      });

      const topStyles = Array.from(styleUsageMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((style) => ({
          styleName: style.name,
          libraryName: style.library,
          usageCount: style.count,
        }));

      const mixedUsageCount = textLayers.filter((layer: any) => {
        const hasStyle = layer.styleAssignment?.assignmentStatus !== 'unstyled';
        const layerTokens = layer.tokens;
        const hasToken = layerTokens && layerTokens.length > 0;
        return hasStyle && hasToken;
      }).length;

      return {
        styleAdoptionRate,
        tokenAdoptionRate,
        tokenCoverageRate,
        libraryDistribution,
        topStyles,
        mixedUsageCount,
        totalTokenCount: 0,
        uniqueTokensUsed: 0,
        unusedTokenCount: 0,
        totalTokenBindings: 0,
        tokensByCollection: {},
        elementCount: textLayers.length,
        elementsWithTokens: textLayers.filter(
          (layer: any) => layer.tokens && layer.tokens.length > 0
        ).length,
        elementsWithoutTokens: textLayers.filter(
          (layer: any) => !layer.tokens || layer.tokens.length === 0
        ).length,
      };
    }
  }, [auditResult]);

  if (error) {
    return (
      <div
        className="p-4 bg-red-50 border border-red-200 rounded-lg animate-fadeIn"
        style={{
          animation: 'fadeIn 0.3s ease-out',
        }}
      >
        <p className="text-red-700 text-sm font-medium">Error loading analytics</p>
        <p className="text-red-600 text-xs mt-1">{error}</p>
      </div>
    );
  }

  const totalLayers =
    'textLayers' in (auditResult || {})
      ? (auditResult as AuditResult).textLayers?.length || 0
      : 'layers' in (auditResult || {})
        ? (auditResult as StyleGovernanceAuditResult).layers?.length || 0
        : 0;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            width: 0;
          }
          to {
            width: var(--target-width, 100%);
          }
        }
      `}</style>

      <div className="space-y-2 p-2">
        {/* Header */}
        {/*<div className="pb-3">
          <h2 className="text-lg font-semibold text-figma-text">Analytics Dashboard</h2>
          <p className="text-figma-text-tertiary text-xs mt-1">
            Design system adoption and token usage metrics
          </p>
        </div>*/}

        {/* Key Metrics Grid - 2 columns on desktop, 1 on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : (
            <>
              {/* Style Adoption Rate */}
              <MetricCard
                label="Style Adoption Rate"
                value={metrics.styleAdoptionRate}
                suffix="%"
                decimals={1}
                icon="✨"
                variant={
                  metrics.styleAdoptionRate >= 80
                    ? 'success'
                    : metrics.styleAdoptionRate >= 50
                      ? 'warning'
                      : 'danger'
                }
              />

              {/* Token Adoption Rate
               * Definition: Percentage of text layers in the document that use design tokens
               * Formula: (Number of layers using tokens / Total text layers) × 100%
               * Example: If 40 of 100 text layers use tokens, Token Adoption = 40%
               *
               * NOTE: This is different from "Token Coverage" which measures which tokens are used
               * - Token Adoption (layer-centric): "Of the layers we have, how many use tokens?"
               * - Token Coverage (token-centric): "Of the tokens we have, how many are used?"
               *
               * Health indicators:
               * - 80%+ (success): Excellent token integration across document
               * - 40-80% (warning): Moderate adoption, opportunity for more token usage
               * - <40% (danger): Low adoption, token system under-utilized
               *
               * See spec.md "Metrics Definitions" section for full documentation
               */}
              <MetricCard
                label="Token Adoption Rate"
                value={metrics.tokenAdoptionRate}
                suffix="%"
                decimals={1}
                icon="🏷️"
                variant={
                  metrics.tokenAdoptionRate >= 80
                    ? 'success'
                    : metrics.tokenAdoptionRate >= 40
                      ? 'warning'
                      : 'danger'
                }
              />

              {/* Token Coverage
               * Definition: Percentage of available design tokens that are actively used in at least one text layer
               * Formula: (Number of unique tokens used / Total number of tokens) × 100%
               * Example: If 30 of your 50 design tokens are used, Token Coverage = 60%
               *
               * NOTE: This is different from "Token Adoption" which measures % of layers using tokens
               * - Token Coverage (token-centric): "Of the tokens we have, how many are used?"
               * - Token Adoption (layer-centric): "Of the layers we have, how many use tokens?"
               *
               * Health indicators:
               * - 60%+ (success): Good token utilization, system is well-integrated
               * - 30-60% (warning): Moderate coverage, consider consolidating unused tokens
               * - <30% (danger): Low coverage, token system may need review
               *
               * See spec.md "Metrics Definitions" section for full documentation
               */}
              <MetricCard
                label="Token Coverage"
                value={metrics.tokenCoverageRate}
                suffix="%"
                decimals={1}
                icon="🎯"
                variant={
                  metrics.tokenCoverageRate >= 60
                    ? 'success'
                    : metrics.tokenCoverageRate >= 30
                      ? 'warning'
                      : 'danger'
                }
              />

              {/* Total Styled Layers */}
              <MetricCard
                label="Styled Text Layers"
                value={Math.round((metrics.styleAdoptionRate / 100) * totalLayers)}
                icon="📄"
                variant="default"
              />

              {/* Mixed Usage */}
              <MetricCard
                label="Mixed Usage Layers"
                value={metrics.mixedUsageCount}
                icon="🔀"
                variant="default"
              />
            </>
          )}
        </div>

        {/* Content Grid - 2 columns on desktop, 1 on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Top Styles Table */}
          <div
            className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-fadeInScale"
            style={{
              animation: 'fadeInScale 0.4s ease-out 0.1s forwards',
              opacity: 0,
            }}
          >
            <h3 className="text-sm font-semibold text-figma-text mb-4">Top 10 Most Used Styles</h3>
            <TopStylesTable
              styles={metrics.topStyles}
              totalLayers={totalLayers}
              isLoading={isLoading}
            />
          </div>

          {/* Right Column: Distribution & Comparison */}
          <div className="space-y-6">
            {/* Library Distribution */}
            <div
              className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-fadeInScale"
              style={{
                animation: 'fadeInScale 0.4s ease-out 0.15s forwards',
                opacity: 0,
              }}
            >
              <h3 className="text-sm font-semibold text-figma-text mb-4">Library Distribution</h3>
              <LibraryDistributionCard
                distribution={metrics.libraryDistribution}
                isLoading={isLoading}
              />
            </div>

            {/* Usage Comparison */}
            <div
              className="border border-figma-border rounded-lg p-4 bg-figma-bg-secondary animate-fadeInScale"
              style={{
                animation: 'fadeInScale 0.4s ease-out 0.2s forwards',
                opacity: 0,
              }}
            >
              <h3 className="text-sm font-semibold text-figma-text mb-4">Token vs Style Usage</h3>
              <UsageComparisonCard
                styleAdoptionRate={metrics.styleAdoptionRate}
                tokenCoverageRate={metrics.tokenCoverageRate}
                mixedUsageCount={metrics.mixedUsageCount}
                totalLayers={totalLayers}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Token Metrics Details - New Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Token Inventory */}
          <TokenInventorySection
            totalTokenCount={metrics.totalTokenCount}
            tokensByCollection={metrics.tokensByCollection}
            isLoading={isLoading}
          />

          {/* Token Coverage Breakdown */}
          <TokenCoverageBreakdownSection
            elementCount={metrics.elementCount}
            fullTokenCoverageCount={(metrics as any).fullTokenCoverageCount || 0}
            fullTokenCoverageRate={(metrics as any).fullTokenCoverageRate || 0}
            partialTokenCoverageCount={(metrics as any).partialTokenCoverageCount || 0}
            partialTokenCoverageRate={(metrics as any).partialTokenCoverageRate || 0}
            noTokenCoverageCount={
              (metrics as any).noTokenCoverageCount || metrics.elementsWithoutTokens || 0
            }
            noTokenCoverageRate={(metrics as any).noTokenCoverageRate || 0}
            isLoading={isLoading}
          />

          {/* Token Usage Depth */}
          <TokenUsageDepthSection
            totalTokenBindings={metrics.totalTokenBindings}
            elementsWithTokens={metrics.elementsWithTokens}
            uniqueTokensUsed={metrics.uniqueTokensUsed}
            totalTokenCount={metrics.totalTokenCount}
            unusedTokenCount={metrics.unusedTokenCount}
            isLoading={isLoading}
          />
        </div>

        {/* Footer Info */}
        {!isLoading && auditResult && (
          <div
            className="border-t border-figma-border pt-3 text-xs text-figma-text-tertiary animate-fadeIn"
            style={{
              animation: 'fadeIn 0.4s ease-out 0.3s forwards',
              opacity: 0,
            }}
          >
            <p>
              Audit performed on {new Date(auditResult.timestamp).toLocaleDateString()} at{' '}
              {new Date(auditResult.timestamp).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

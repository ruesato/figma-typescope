/**
 * Analytics Dashboard - Displays text style and token usage metrics
 *
 * Layout:
 * - Row 1: 3 stat cards (Text Styles, Tokens, Unstyled Layers)
 * - Row 2: 2 columns
 *   - Left: Style Usage by Library, Top 10 Text Styles
 *   - Right: Token Coverage, Top 10 Type Tokens
 */

import { useMemo } from 'react';
import type { StyleGovernanceAuditResult } from '@/shared/types';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsDashboardProps {
  auditResult: StyleGovernanceAuditResult | null;
  isLoading?: boolean;
  error?: string | null;
}

interface StatCardProps {
  label: string;
  used: number;
  total: number;
  variant: 'styles' | 'tokens' | 'neutral';
}

interface DataListItem {
  id: string;
  name: string;
  value: number;
}

interface DataListProps {
  title: string;
  items: DataListItem[];
  variant: 'styles' | 'tokens';
  emptyMessage?: string;
}

interface UsageCardProps {
  title: string;
  items: Array<{ name: string; value: number }>;
  variant: 'styles' | 'tokens';
}

// ============================================================================
// Color Utilities
// ============================================================================

const variantColors = {
  styles: {
    bg: 'bg-[#0c1b33]',
    border: 'border-blue-800/30',
    accent: 'text-blue-400',
    bar: 'bg-blue-500',
    barBg: 'bg-blue-900/50',
  },
  tokens: {
    bg: 'bg-[#120522]',
    border: 'border-purple-800/30',
    accent: 'text-purple-400',
    bar: 'bg-purple-500',
    barBg: 'bg-purple-900/50',
  },
  neutral: {
    bg: 'bg-[#0a0a0a]',
    border: 'border-zinc-800/50',
    accent: 'text-zinc-400',
    bar: 'bg-zinc-500',
    barBg: 'bg-zinc-800/50',
  },
};

// ============================================================================
// Components
// ============================================================================

/**
 * Stat Card - Displays a single metric with used/total count
 */
function StatCard({ label, used, total, variant }: StatCardProps) {
  const colors = variantColors[variant];
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div
      className={`rounded-lg p-4 ${colors.bg} border ${colors.border} flex flex-col gap-2`}
    >
      <div className="text-xs text-zinc-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-semibold text-white">
        {used.toLocaleString()}{' '}
        <span className="text-sm font-normal text-zinc-500">
          of {total.toLocaleString()}
        </span>
      </div>
      <div className={`h-1 rounded-full ${colors.barBg} overflow-hidden`}>
        <div
          className={`h-full ${colors.bar} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Usage Card - Displays breakdown with horizontal bars
 */
function UsageCard({ title, items, variant }: UsageCardProps) {
  const colors = variantColors[variant];
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div
      className={`rounded-lg p-4 ${colors.bg} border ${colors.border} flex flex-col gap-3`}
    >
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="text-xs text-zinc-500 italic">No data available</div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 truncate max-w-[180px]">
                  {item.name}
                </span>
                <span className={colors.accent}>
                  {item.value.toLocaleString()}
                </span>
              </div>
              <div
                className={`h-1.5 rounded-full ${colors.barBg} overflow-hidden`}
              >
                <div
                  className={`h-full ${colors.bar} rounded-full transition-all duration-300`}
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Data List - Displays a ranked list of items with counts
 */
function DataList({
  title,
  items,
  variant,
  emptyMessage = 'No items found',
}: DataListProps) {
  const colors = variantColors[variant];

  return (
    <div
      className={`rounded-lg p-4 ${colors.bg} border ${colors.border} flex flex-col gap-3 flex-1`}
    >
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="flex flex-col gap-1 overflow-auto max-h-[240px]">
        {items.length === 0 ? (
          <div className="text-xs text-zinc-500 italic">{emptyMessage}</div>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center gap-2 py-1.5 border-b border-zinc-800/30 last:border-b-0"
            >
              <span className="text-xs text-zinc-500 w-5 text-right">
                {idx + 1}.
              </span>
              <span className="text-xs text-zinc-300 truncate flex-1">
                {item.name}
              </span>
              <span className={`text-xs ${colors.accent} tabular-nums`}>
                {item.value.toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Loading State
 */
function LoadingState() {
  return (
    <div className="flex flex-col gap-4 p-4 animate-pulse">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-zinc-800/50 rounded-lg" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          <div className="h-40 bg-zinc-800/50 rounded-lg" />
          <div className="h-64 bg-zinc-800/50 rounded-lg" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-40 bg-zinc-800/50 rounded-lg" />
          <div className="h-64 bg-zinc-800/50 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Error State
 */
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-red-400 text-sm font-medium mb-1">
          Error loading analytics
        </div>
        <div className="text-zinc-500 text-xs">{message}</div>
      </div>
    </div>
  );
}

/**
 * Empty State
 */
function EmptyState() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-zinc-400 text-sm font-medium mb-1">
          No audit data available
        </div>
        <div className="text-zinc-500 text-xs">
          Run an audit to see analytics
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AnalyticsDashboard({
  auditResult,
  isLoading = false,
  error = null,
}: AnalyticsDashboardProps) {
  // Compute derived metrics
  const computedMetrics = useMemo(() => {
    if (!auditResult) return null;

    const { styles, tokens, metrics, totalTextLayers } = auditResult;

    // DEBUG: Log what data the UI received
    console.log('[DASHBOARD UI] Received audit result:', {
      totalStyles: styles.length,
      totalTokens: tokens.length,
      totalLayers: totalTextLayers,
      libraryDistribution: metrics.libraryDistribution,
    });

    // Text styles: count styles with at least one usage
    const usedStylesCount = styles.filter((s) => s.usageCount > 0).length;
    const totalStylesCount = styles.length;

    console.log('[DASHBOARD UI] Style counts:', {
      usedStylesCount,
      totalStylesCount,
      stylesWithUsage: styles.filter((s) => s.usageCount > 0).map(s => ({
        name: s.name,
        usageCount: s.usageCount,
      })).slice(0, 5),
    });

    // Tokens: from metrics
    const usedTokensCount = metrics.uniqueTokensUsed;
    const totalTokensCount = metrics.totalTokenCount;

    // Unstyled layers
    const unstyledCount = metrics.unstyledCount;

    // Library distribution - convert to array and sort by value
    const libraryUsage = Object.entries(metrics.libraryDistribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Token coverage breakdown
    const tokenCoverage = [
      { name: 'Full coverage', value: metrics.fullTokenCoverageCount },
      { name: 'Partial coverage', value: metrics.partialTokenCoverageCount },
      { name: 'No tokens', value: metrics.noTokenCoverageCount },
    ].filter((item) => item.value > 0);

    // Top 10 text styles
    const topStyles: DataListItem[] = metrics.topStyles
      .slice(0, 10)
      .map((s) => ({
        id: s.styleId,
        name: s.styleName,
        value: s.usageCount,
      }));

    // Top 10 type-related tokens (sorted by usage count)
    const topTokens: DataListItem[] = [...tokens]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        name: t.name,
        value: t.usageCount,
      }));

    return {
      usedStylesCount,
      totalStylesCount,
      usedTokensCount,
      totalTokensCount,
      unstyledCount,
      totalTextLayers,
      libraryUsage,
      tokenCoverage,
      topStyles,
      topTokens,
    };
  }, [auditResult]);

  // Handle states
  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!auditResult || !computedMetrics) {
    return <EmptyState />;
  }

  const {
    usedStylesCount,
    totalStylesCount,
    usedTokensCount,
    totalTokensCount,
    unstyledCount,
    totalTextLayers,
    libraryUsage,
    tokenCoverage,
    topStyles,
    topTokens,
  } = computedMetrics;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Text styles used"
          used={usedStylesCount}
          total={totalStylesCount}
          variant="styles"
        />
        <StatCard
          label="Tokens used"
          used={usedTokensCount}
          total={totalTokensCount}
          variant="tokens"
        />
        <StatCard
          label="Unstyled text layers"
          used={unstyledCount}
          total={totalTextLayers}
          variant="neutral"
        />
      </div>

      {/* Row 2: Two Columns */}
      <div className="grid grid-cols-2 gap-3">
        {/* Left Column: Styles */}
        <div className="flex flex-col gap-3">
          <UsageCard
            title="Style Usage"
            items={libraryUsage}
            variant="styles"
          />
          <DataList
            title="Top 10 Text Styles"
            items={topStyles}
            variant="styles"
            emptyMessage="No styles found"
          />
        </div>

        {/* Right Column: Tokens */}
        <div className="flex flex-col gap-3">
          <UsageCard
            title="Token Coverage"
            items={tokenCoverage}
            variant="tokens"
          />
          <DataList
            title="Top 10 Type Tokens"
            items={topTokens}
            variant="tokens"
            emptyMessage="No tokens found"
          />
        </div>
      </div>
    </div>
  );
}

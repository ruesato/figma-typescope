import React from 'react';
import type { AuditSummary } from '@/shared/types';

interface SummaryDashboardProps {
  summary: AuditSummary;
}

/**
 * Summary Dashboard Component
 *
 * Displays high-level audit statistics and insights.
 *
 * @example
 * ```tsx
 * <SummaryDashboard summary={auditResult.summary} />
 * ```
 */
export default function SummaryDashboard({ summary }: SummaryDashboardProps) {
  const {
    totalTextLayers,
    uniqueFontFamilies,
    styleCoveragePercent,
    librariesInUse,
    potentialMatchesCount,
    hiddenLayersCount,
  } = summary;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-figma-border pb-2">
        <h2 className="text-lg font-semibold text-figma-text">Audit Summary</h2>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Layers */}
        <StatCard
          label="Text Layers"
          value={totalTextLayers.toLocaleString()}
          icon="📄"
        />

        {/* Unique Fonts */}
        <StatCard
          label="Font Families"
          value={uniqueFontFamilies.toLocaleString()}
          icon="🔤"
        />

        {/* Style Coverage */}
        <StatCard
          label="Style Coverage"
          value={`${styleCoveragePercent}%`}
          icon="✨"
          variant={
            styleCoveragePercent >= 80
              ? 'success'
              : styleCoveragePercent >= 50
              ? 'warning'
              : 'danger'
          }
        />

        {/* Hidden Layers */}
        {hiddenLayersCount > 0 && (
          <StatCard
            label="Hidden Layers"
            value={hiddenLayersCount.toLocaleString()}
            icon="👁️"
            variant="neutral"
          />
        )}

        {/* Potential Matches */}
        {potentialMatchesCount > 0 && (
          <StatCard
            label="Potential Matches"
            value={potentialMatchesCount.toLocaleString()}
            icon="🎯"
            variant="warning"
          />
        )}
      </div>

      {/* Libraries */}
      {librariesInUse.length > 0 && (
        <div className="pt-2 border-t border-figma-border">
          <h3 className="text-sm font-medium text-figma-text-secondary mb-2">
            Libraries in Use
          </h3>
          <div className="flex flex-wrap gap-2">
            {librariesInUse.map((library) => (
              <span
                key={library}
                className="badge badge-neutral text-xs"
              >
                {library}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// StatCard Component
// ============================================================================

interface StatCardProps {
  label: string;
  value: string;
  icon?: string;
  variant?: 'success' | 'warning' | 'danger' | 'neutral';
}

function StatCard({ label, value, icon, variant = 'neutral' }: StatCardProps) {
  const variantStyles = {
    success: 'bg-figma-bg-secondary border-l-4 border-l-green-500',
    warning: 'bg-figma-bg-secondary border-l-4 border-l-yellow-500',
    danger: 'bg-figma-bg-secondary border-l-4 border-l-red-500',
    neutral: 'bg-figma-bg-secondary',
  };

  return (
    <div
      className={`p-3 rounded-md ${variantStyles[variant]}`}
    >
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-figma-text-secondary">{label}</span>
        {icon && <span className="text-sm">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-figma-text">{value}</div>
    </div>
  );
}

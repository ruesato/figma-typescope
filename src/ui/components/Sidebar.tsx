import { BarChart3, FolderKanban, Coins } from 'lucide-react';
import Badge from './Badge';

export type TabType = 'analytics' | 'styles' | 'tokens';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  disabledTabs?: TabType[];
  styleBadgeCount?: number;
  tokenBadgeCount?: number;
}

const tabs = [
  {
    id: 'analytics' as TabType,
    icon: BarChart3,
    label: 'Analytics',
    tooltip: 'View analytics and metrics',
  },
  {
    id: 'styles' as TabType,
    icon: FolderKanban,
    label: 'Styles',
    tooltip: 'Browse and manage styles',
  },
  {
    id: 'tokens' as TabType,
    icon: Coins,
    label: 'Tokens',
    tooltip: 'Browse and manage design tokens',
  },
];

export default function Sidebar({
  activeTab,
  onTabChange,
  disabledTabs = [],
  styleBadgeCount = 0,
  tokenBadgeCount = 0,
}: SidebarProps) {
  return (
    <div
      className="h-full flex flex-col items-center gap-8"
      style={{
        minWidth: '48px',
        backgroundColor: 'var(--figma-color-bg)',
        padding: 'var(--figma-space-md) var(--figma-space-md)',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const isDisabled = disabledTabs.includes(tab.id);

        // Get badge count for this tab
        let badgeCount = 0;
        if (tab.id === 'styles') {
          badgeCount = styleBadgeCount;
        } else if (tab.id === 'tokens') {
          badgeCount = tokenBadgeCount;
        }

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            className="relative group"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isActive ? 'var(--figma-color-bg-brand)' : 'transparent',
              color: isActive
                ? 'var(--figma-color-text-onbrand)'
                : isDisabled
                  ? 'var(--figma-color-text-tertiary)'
                  : 'var(--figma-color-icon-secondary)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              border: 'none',
              transition: 'all 0.2s ease',
            }}
            aria-label={tab.label}
            onMouseEnter={(e) => {
              if (!isActive && !isDisabled) {
                e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <Icon size={16} />
            {/* Badge - only for Styles and Tokens tabs */}
            {badgeCount > 0 && <Badge count={badgeCount} />}
            {/* Tooltip */}
            {!isDisabled && (
              <div
                className="absolute left-full ml-2 px-2 py-1 rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-500"
                style={{
                  backgroundColor: 'var(--figma-color-text)',
                  color: 'var(--figma-color-bg)',
                  fontSize: '11px',
                }}
              >
                {tab.tooltip}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

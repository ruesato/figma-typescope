import type { TabType } from './Sidebar';

interface HeaderProps {
  activeTab: TabType;
  onNewAnalysis?: () => void;
  showActions?: boolean;
}

const tabTitles: Record<TabType, string> = {
  analytics: 'Analytics Dashboard',
  styles: 'Text Styles',
  tokens: 'Tokens',
};

export default function Header({ activeTab, onNewAnalysis, showActions = false }: HeaderProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: 'var(--figma-space-md) var(--figma-space-lg) 0',
        // borderBottom: '1px solid var(--figma-color-border)',
      }}
    >
      <h1
        style={{
          fontSize: '18px',
          fontWeight: 700,
          lineHeight: '28px',
          color: 'var(--figma-color-text-secondary)',
          margin: 0,
        }}
      >
        {tabTitles[activeTab]}
      </h1>

      {showActions && onNewAnalysis && (
        <button
          onClick={onNewAnalysis}
          style={{
            height: '36px',
            padding: '8px 16px',
            border: '1px solid var(--figma-color-border)',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            color: 'var(--figma-color-text)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          New analysis
        </button>
      )}
    </div>
  );
}

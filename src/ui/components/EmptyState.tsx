interface EmptyStateProps {
  message: string;
  onAnalyzeFile?: () => void;
  onAnalyzeSelection?: () => void;
}

export default function EmptyState({
  message,
  onAnalyzeFile,
  onAnalyzeSelection,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '276px',
        gap: '32px',
      }}
    >
      <p
        style={{
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: '20px',
          color: 'var(--figma-color-text-secondary)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {message}
      </p>

      {(onAnalyzeFile || onAnalyzeSelection) && (
        <div
          className="flex items-center justify-center gap-4"
          style={{
            width: '100%',
          }}
        >
          {onAnalyzeSelection && (
            <button
              onClick={onAnalyzeSelection}
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
              Analyze selection
            </button>
          )}

          {onAnalyzeFile && (
            <button
              onClick={onAnalyzeFile}
              style={{
                height: '36px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: 'var(--figma-color-bg-brand)',
                color: 'var(--figma-color-text-onbrand)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Analyze file
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X, CheckSquare, Square, File } from 'lucide-react';

interface Page {
  id: string;
  name: string;
}

interface PageSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pageIds: string[]) => void;
}

/**
 * Page Selector Modal
 *
 * Allows users to select which pages to audit before running the scan.
 * Shows all pages in the document with checkboxes for selection.
 * Includes "Select All" / "Deselect All" controls.
 */
export default function PageSelector({ isOpen, onClose, onConfirm }: PageSelectorProps) {
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch available pages when dialog opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Request page list from main context
      window.parent.postMessage(
        { pluginMessage: { type: 'GET_PAGES' } },
        '*'
      );
    }
  }, [isOpen]);

  // Listen for page list from main context
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'PAGES_LIST') {
        const pageList = msg.payload.pages as Page[];
        setPages(pageList);
        // Select all pages by default
        setSelectedPageIds(new Set(pageList.map(p => p.id)));
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleTogglePage = (pageId: string) => {
    setSelectedPageIds(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedPageIds(new Set(pages.map(p => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedPageIds(new Set());
  };

  const handleConfirm = () => {
    if (selectedPageIds.size === 0) return;
    onConfirm(Array.from(selectedPageIds));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '480px',
          maxHeight: '600px',
          backgroundColor: 'var(--figma-color-bg)',
          border: '1px solid var(--figma-color-border)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--figma-space-md)',
            borderBottom: '1px solid var(--figma-color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--figma-color-text)',
              margin: 0,
            }}
          >
            Select Pages to Audit
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '24px',
              height: '24px',
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--figma-color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div
          style={{
            padding: 'var(--figma-space-md)',
            borderBottom: '1px solid var(--figma-color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: 'var(--figma-color-text-secondary)',
            }}
          >
            {selectedPageIds.size} of {pages.length} page{pages.length !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSelectAll}
              disabled={selectedPageIds.size === pages.length}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                border: '1px solid var(--figma-color-border)',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: 'var(--figma-color-text)',
                cursor: selectedPageIds.size === pages.length ? 'not-allowed' : 'pointer',
                opacity: selectedPageIds.size === pages.length ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (selectedPageIds.size !== pages.length) {
                  e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              disabled={selectedPageIds.size === 0}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                border: '1px solid var(--figma-color-border)',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: 'var(--figma-color-text)',
                cursor: selectedPageIds.size === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedPageIds.size === 0 ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (selectedPageIds.size !== 0) {
                  e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Page List */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'var(--figma-space-sm)',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: 'var(--figma-color-text-secondary)',
                fontSize: '12px',
              }}
            >
              Loading pages...
            </div>
          ) : pages.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: 'var(--figma-color-text-secondary)',
                fontSize: '12px',
              }}
            >
              No pages found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {pages.map((page) => {
                const isSelected = selectedPageIds.has(page.id);
                return (
                  <button
                    key={page.id}
                    onClick={() => handleTogglePage(page.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: '1px solid var(--figma-color-border)',
                      borderRadius: '6px',
                      backgroundColor: isSelected ? 'var(--figma-color-bg-brand-tertiary)' : 'var(--figma-color-bg)',
                      color: 'var(--figma-color-text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--figma-color-bg)';
                      }
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare size={16} style={{ color: 'var(--figma-color-bg-brand)', flexShrink: 0 }} />
                    ) : (
                      <Square size={16} style={{ color: 'var(--figma-color-text-tertiary)', flexShrink: 0 }} />
                    )}
                    <File size={14} style={{ color: 'var(--figma-color-text-secondary)', flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: isSelected ? 500 : 400,
                        color: 'var(--figma-color-text)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {page.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--figma-space-md)',
            borderTop: '1px solid var(--figma-color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: '32px',
              padding: '0 16px',
              fontSize: '12px',
              fontWeight: 500,
              border: '1px solid var(--figma-color-border)',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: 'var(--figma-color-text)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--figma-color-bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedPageIds.size === 0}
            style={{
              height: '32px',
              padding: '0 16px',
              fontSize: '12px',
              fontWeight: 500,
              border: 'none',
              borderRadius: '6px',
              backgroundColor: selectedPageIds.size === 0 ? 'var(--figma-color-bg-disabled)' : 'var(--figma-color-bg-brand)',
              color: 'var(--figma-color-text-onbrand)',
              cursor: selectedPageIds.size === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedPageIds.size === 0 ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (selectedPageIds.size > 0) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPageIds.size > 0) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            Analyze {selectedPageIds.size} Page{selectedPageIds.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </>
  );
}

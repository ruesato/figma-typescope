import React from 'react';
import type { TextLayerData } from '@/shared/types';

interface LayerItemProps {
  layer: TextLayerData;
  onNavigate?: (layerId: string) => void;
}

/**
 * Layer Item Component
 *
 * Displays a single text layer with its metadata, style assignment,
 * and component context.
 *
 * @example
 * ```tsx
 * <LayerItem
 *   layer={textLayer}
 *   onNavigate={(id) => navigateToLayer(id)}
 * />
 * ```
 */
export default function LayerItem({ layer, onNavigate }: LayerItemProps) {
  const {
    id,
    content,
    fontFamily,
    fontSize,
    fontWeight,
    styleAssignment,
    componentContext,
    visible,
  } = layer;

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(id);
    }
  };

  // Get assignment status badge variant
  const getStatusBadge = () => {
    switch (styleAssignment.assignmentStatus) {
      case 'fully-styled':
        return <span className="badge badge-success">Styled</span>;
      case 'partially-styled':
        return <span className="badge badge-warning">Partial</span>;
      case 'unstyled':
        return <span className="badge badge-danger">Unstyled</span>;
    }
  };

  // Get component type badge
  const getComponentBadge = () => {
    switch (componentContext.componentType) {
      case 'main-component':
        return <span className="badge badge-neutral">Component</span>;
      case 'instance': {
        const isOverridden = componentContext.overrideStatus === 'overridden';
        return (
          <span className={`badge ${isOverridden ? 'badge-warning' : 'badge-neutral'}`}>
            {isOverridden ? 'Instance (Override)' : 'Instance'}
          </span>
        );
      }
      case 'plain':
        return null;
    }
  };

  return (
    <div
      className={`
        p-3 border border-figma-border rounded-md
        hover:bg-figma-bg-secondary cursor-pointer
        transition-colors
        ${!visible ? 'opacity-50' : ''}
      `}
      onClick={handleClick}
    >
      {/* Header with badges */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {/* Hierarchy path */}
          {componentContext.hierarchyPath.length > 0 && (
            <div className="text-xs text-figma-text-tertiary truncate mb-1">
              {componentContext.hierarchyPath.join(' → ')}
            </div>
          )}

          {/* Text content preview */}
          <div className="text-sm text-figma-text font-medium truncate">{content || '(empty)'}</div>
        </div>

        {/* Status badges */}
        <div className="flex gap-1 flex-shrink-0">
          {getStatusBadge()}
          {!visible && <span className="badge badge-neutral">Hidden</span>}
        </div>
      </div>

      {/* Font info */}
      <div className="text-xs text-figma-text-secondary mb-2">
        {fontFamily} · {fontSize}px · Weight {fontWeight}
      </div>

      {/* Style assignment info */}
      {styleAssignment.styleName && (
        <div className="text-xs text-figma-text-secondary mb-2">
          Style: <span className="font-medium">{styleAssignment.styleName}</span>
          {styleAssignment.libraryName && (
            <span className="text-figma-text-tertiary ml-1">({styleAssignment.libraryName})</span>
          )}
        </div>
      )}

      {/* Component type badge */}
      {getComponentBadge() && <div className="mt-2">{getComponentBadge()}</div>}

      {/* Property matches (for partially styled) */}
      {styleAssignment.assignmentStatus === 'partially-styled' &&
        styleAssignment.propertyMatches && (
          <div className="mt-2 pt-2 border-t border-figma-border">
            <div className="text-xs text-figma-text-tertiary mb-1">Property Matches:</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(styleAssignment.propertyMatches).map(([property, matches]) => (
                <span
                  key={property}
                  className={`badge ${matches ? 'badge-success' : 'badge-danger'}`}
                >
                  {property}
                </span>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

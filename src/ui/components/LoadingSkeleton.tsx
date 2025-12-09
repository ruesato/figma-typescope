/**
 * LoadingSkeleton Component
 *
 * Displays skeleton loading states for various content areas.
 * Provides visual feedback while data is loading.
 */

interface LoadingSkeletonProps {
  type: 'tree' | 'list' | 'panel' | 'card' | 'table';
  count?: number;
}

export default function LoadingSkeleton({ type, count = 1 }: LoadingSkeletonProps) {
  const skeletons = Array.from({ length: count });

  const animationClass =
    'animate-pulse bg-gradient-to-r from-figma-bg-secondary via-figma-bg-tertiary to-figma-bg-secondary';

  switch (type) {
    case 'tree':
      return (
        <div className="space-y-2">
          {skeletons.map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${animationClass}`} />
              <div className={`flex-1 h-5 rounded ${animationClass}`} />
              <div className={`w-12 h-4 rounded ${animationClass}`} />
            </div>
          ))}
        </div>
      );

    case 'list':
      return (
        <div className="space-y-3">
          {skeletons.map((_, i) => (
            <div key={i} className="p-3 border border-figma-border rounded">
              <div className={`h-4 rounded mb-2 ${animationClass}`} />
              <div className={`h-3 rounded w-2/3 ${animationClass}`} />
            </div>
          ))}
        </div>
      );

    case 'panel':
      return (
        <div className="space-y-4">
          <div className={`h-6 rounded w-1/2 ${animationClass}`} />
          <div className="space-y-2">
            {skeletons.map((_, i) => (
              <div key={i} className={`h-4 rounded ${animationClass}`} />
            ))}
          </div>
        </div>
      );

    case 'card':
      return (
        <div className="p-4 border border-figma-border rounded space-y-3">
          <div className={`h-5 rounded w-3/4 ${animationClass}`} />
          <div className="grid grid-cols-2 gap-2">
            <div className={`h-8 rounded ${animationClass}`} />
            <div className={`h-8 rounded ${animationClass}`} />
          </div>
        </div>
      );

    case 'table':
      return (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-4 gap-2 pb-2 border-b border-figma-border">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-4 rounded ${animationClass}`} />
            ))}
          </div>
          {/* Rows */}
          {skeletons.map((_, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((colIdx) => (
                <div key={colIdx} className={`h-4 rounded ${animationClass}`} />
              ))}
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
}

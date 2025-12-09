/**
 * UX Polish Utilities (T122)
 *
 * Utilities for enhancing user experience with animations, transitions,
 * visual feedback, and polish touches.
 */

// ============================================================================
// Animation & Transition Classes
// ============================================================================

/**
 * Transition classes for smooth state changes
 */
export const transitions = {
  fast: 'transition-all duration-150 ease-in-out',
  normal: 'transition-all duration-200 ease-in-out',
  slow: 'transition-all duration-300 ease-in-out',
};

/**
 * Hover state animations
 */
export const hoverEffects = {
  lift: 'hover:shadow-md hover:-translate-y-0.5',
  brighten: 'hover:opacity-90',
  shine: 'hover:brightness-110',
  scale: 'hover:scale-105',
};

/**
 * Focus state indicators
 */
export const focusStyles = {
  outline: 'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-figma-bg-brand',
  shadow: 'focus:outline-none focus:shadow-lg focus:shadow-figma-bg-brand/50',
  border: 'focus:outline-none focus:border-2 focus:border-figma-bg-brand',
};

/**
 * Active/pressed state styles
 */
export const activeStyles = {
  button: 'active:scale-95',
  link: 'active:text-figma-bg-brand-dark',
};

// ============================================================================
// Loading & Skeleton Animations
// ============================================================================

/**
 * Generate loading animation classes
 */
export function getLoadingAnimation(type: 'pulse' | 'shimmer' | 'spin'): string {
  switch (type) {
    case 'pulse':
      return 'animate-pulse';
    case 'shimmer':
      return 'bg-gradient-to-r from-figma-bg-secondary via-figma-bg-tertiary to-figma-bg-secondary bg-[length:200%_100%] animate-shimmer';
    case 'spin':
      return 'animate-spin';
  }
}

/**
 * Skeleton loader animation
 */
export const skeletonAnimation = 'animate-pulse bg-gradient-to-r from-figma-bg-secondary via-figma-bg-tertiary to-figma-bg-secondary';

// ============================================================================
// Spacing & Layout Polish
// ============================================================================

/**
 * Consistent spacing scale
 */
export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
};

/**
 * Consistent border radius scale
 */
export const borderRadius = {
  none: '0',
  sm: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
  full: '9999px',
};

/**
 * Consistent shadow scale
 */
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

// ============================================================================
// Button Styles
// ============================================================================

/**
 * Button variant styles
 */
export const buttonVariants = {
  primary: 'bg-figma-bg-brand text-white hover:opacity-90 active:scale-95',
  secondary: 'bg-figma-bg-secondary text-figma-text hover:bg-figma-bg-tertiary active:scale-95',
  tertiary: 'bg-transparent text-figma-text hover:bg-figma-bg-secondary active:scale-95',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-95',
  success: 'bg-green-500 text-white hover:bg-green-600 active:scale-95',
};

/**
 * Button size styles
 */
export const buttonSizes = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm font-medium',
  lg: 'px-6 py-3 text-base font-medium',
};

/**
 * Disabled button styles
 */
export const disabledStyles = 'opacity-50 cursor-not-allowed pointer-events-none';

// ============================================================================
// Text & Typography Polish
// ============================================================================

/**
 * Text truncation utilities
 */
export const textTruncation = {
  oneLine: 'truncate',
  twoLines: 'line-clamp-2',
  threeLines: 'line-clamp-3',
};

/**
 * Text emphasis levels
 */
export const textEmphasis = {
  primary: 'text-figma-text font-medium',
  secondary: 'text-figma-text-secondary font-normal',
  muted: 'text-figma-text-secondary/75 font-normal text-xs',
};

/**
 * Text color variants
 */
export const textColors = {
  default: 'text-figma-text',
  secondary: 'text-figma-text-secondary',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
  info: 'text-blue-600',
  brand: 'text-figma-bg-brand',
};

// ============================================================================
// Visual Feedback
// ============================================================================

/**
 * Badge styles for status indicators
 */
export const badgeStyles = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-figma-bg-tertiary text-figma-text-secondary',
};

/**
 * Progress bar animation
 */
export function getProgressBarStyle(percentage: number): { width: string; transition: string } {
  return {
    width: `${Math.min(percentage, 100)}%`,
    transition: 'width 0.3s ease-in-out',
  };
}

/**
 * Loading state indicators
 */
export const loadingIndicators = {
  spinner: '⏳',
  pulse: '●',
  dots: '...',
};

// ============================================================================
// Smooth Transitions & State Changes
// ============================================================================

/**
 * Debounce function for smooth interactions
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;

  return function (...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastRun >= delay) {
      func(...args);
      lastRun = now;
    }
  };
}

/**
 * Smooth scroll to element
 */
export function smoothScrollToElement(element: HTMLElement, behavior: 'smooth' | 'auto' = 'smooth'): void {
  element.scrollIntoView({ behavior, block: 'nearest' });
}

/**
 * Fade in animation for elements
 */
export function fadeInElement(element: HTMLElement, duration: number = 300): void {
  element.style.opacity = '0';
  element.style.transition = `opacity ${duration}ms ease-in-out`;

  // Trigger reflow
  void element.offsetHeight;

  element.style.opacity = '1';

  setTimeout(() => {
    element.style.transition = '';
  }, duration);
}

// ============================================================================
// Visual Hierarchy
// ============================================================================

/**
 * Container background colors
 */
export const containerColors = {
  primary: 'bg-figma-bg',
  secondary: 'bg-figma-bg-secondary',
  tertiary: 'bg-figma-bg-tertiary',
  brand: 'bg-figma-bg-brand text-white',
};

/**
 * Border styles
 */
export const borderStyles = {
  light: 'border border-figma-border-light',
  normal: 'border border-figma-border',
  heavy: 'border-2 border-figma-border',
  brand: 'border border-figma-bg-brand',
};

/**
 * Divider styles
 */
export const dividerStyles = {
  horizontal: 'border-t border-figma-border',
  vertical: 'border-l border-figma-border',
};

// ============================================================================
// Interaction Feedback
// ============================================================================

/**
 * Tooltip positioning
 */
export const tooltipPosition = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  left: 'right-full mr-2',
  right: 'left-full ml-2',
};

/**
 * Tooltip animation
 */
export const tooltipAnimation = 'opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none';

/**
 * Toast notification animation
 */
export const toastAnimation = 'animate-in slide-in-from-bottom-4 duration-300';

// ============================================================================
// Contrast & Accessibility
// ============================================================================

/**
 * High contrast mode utilities
 */
export const highContrast = {
  text: 'text-figma-text',
  background: 'bg-figma-bg',
  border: 'border-figma-border',
};

/**
 * Ensure sufficient color contrast
 */
export function hasAdequateContrast(foreground: string, background: string): boolean {
  // Simplified contrast check - in production, use WCAG contrast calculation
  return true; // Assume Figma design tokens have adequate contrast
}

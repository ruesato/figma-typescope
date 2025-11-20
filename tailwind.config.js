/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Figma color tokens for plugin UI
        'figma-bg': 'var(--figma-color-bg)',
        'figma-bg-secondary': 'var(--figma-color-bg-secondary)',
        'figma-bg-tertiary': 'var(--figma-color-bg-tertiary)',
        'figma-text': 'var(--figma-color-text)',
        'figma-text-secondary': 'var(--figma-color-text-secondary)',
        'figma-text-tertiary': 'var(--figma-color-text-tertiary)',
        'figma-border': 'var(--figma-color-border)',
        'figma-border-strong': 'var(--figma-color-border-strong)',
        'figma-icon': 'var(--figma-color-icon)',
        'figma-icon-secondary': 'var(--figma-color-icon-secondary)',
        'figma-icon-tertiary': 'var(--figma-color-icon-tertiary)',
        'figma-bg-brand': 'var(--figma-color-bg-brand)',
        'figma-bg-brand-hover': '#0b7fd1',
        'figma-text-onbrand': 'var(--figma-color-text-onbrand)',
        'figma-bg-success': 'var(--figma-color-bg-success)',
        'figma-bg-warning': 'var(--figma-color-bg-warning)',
        'figma-bg-danger': 'var(--figma-color-bg-danger)',
      },
      spacing: {
        'figma-xs': 'var(--figma-space-xs)',
        'figma-sm': 'var(--figma-space-sm)',
        'figma-md': 'var(--figma-space-md)',
        'figma-lg': 'var(--figma-space-lg)',
        'figma-xl': 'var(--figma-space-xl)',
      },
      fontSize: {
        'figma-xs': 'var(--figma-font-size-xs)',
        'figma-sm': 'var(--figma-font-size-sm)',
        'figma-md': 'var(--figma-font-size-md)',
        'figma-lg': 'var(--figma-font-size-lg)',
        'figma-xl': 'var(--figma-font-size-xl)',
      },
      borderRadius: {
        'figma-sm': 'var(--figma-radius-sm)',
        'figma-md': 'var(--figma-radius-md)',
        'figma-lg': 'var(--figma-radius-lg)',
      }
    },
  },
  plugins: [],
}

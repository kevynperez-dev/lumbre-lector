/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          canvas: '#F8F5EF',
          surface: '#FFFEFA',
          muted: '#EEE9DF',
          ink: '#252A26',
          subtle: 'var(--app-subtle-light, #626A63)',
          line: 'var(--app-line-light, #D9D3C8)',
          green: 'var(--app-accent-light, #315B4B)',
          terracotta: '#C45B3C',
        },
        night: {
          canvas: '#171A18',
          surface: '#222724',
          muted: '#2C332E',
          ink: '#F2EEE5',
          subtle: 'var(--app-subtle-dark, #B8BDB5)',
          line: 'var(--app-line-dark, #414943)',
          green: 'var(--app-accent-dark, #A6C7A8)',
          terracotta: '#F08A67',
        },
      },
      fontFamily: {
        editorial: ['serif'],
      },
      fontSize: {
        xs: ['calc(var(--app-font-scale, 1) * 0.75rem)', { lineHeight: 'calc(var(--app-font-scale, 1) * 1rem)' }],
        sm: ['calc(var(--app-font-scale, 1) * 0.875rem)', { lineHeight: 'calc(var(--app-font-scale, 1) * 1.25rem)' }],
        base: ['calc(var(--app-font-scale, 1) * 1rem)', { lineHeight: 'calc(var(--app-font-scale, 1) * 1.5rem)' }],
        lg: ['calc(var(--app-font-scale, 1) * 1.125rem)', { lineHeight: 'calc(var(--app-font-scale, 1) * 1.75rem)' }],
        xl: ['calc(var(--app-font-scale, 1) * 1.25rem)', { lineHeight: 'calc(var(--app-font-scale, 1) * 1.75rem)' }],
        '2xl': ['calc(var(--app-font-scale, 1) * 1.5rem)', { lineHeight: 'calc(var(--app-font-scale, 1) * 2rem)' }],
        '3xl': ['calc(var(--app-font-scale, 1) * 1.875rem)', { lineHeight: 'calc(var(--app-font-scale, 1) * 2.25rem)' }],
        '4xl': ['calc(var(--app-font-scale, 1) * 2.25rem)', { lineHeight: 'calc(var(--app-font-scale, 1) * 2.5rem)' }],
      },
    },
  },
  plugins: [],
};

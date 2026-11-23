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
          subtle: '#626A63',
          line: '#D9D3C8',
          green: '#315B4B',
          terracotta: '#C45B3C',
        },
        night: {
          canvas: '#171A18',
          surface: '#222724',
          muted: '#2C332E',
          ink: '#F2EEE5',
          subtle: '#B8BDB5',
          line: '#414943',
          green: '#A6C7A8',
          terracotta: '#F08A67',
        },
      },
      fontFamily: {
        editorial: ['serif'],
      },
    },
  },
  plugins: [],
};

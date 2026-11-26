// Tokens and type scale from DESIGN.md; colour values live in src/constants/colors.js.
const { colors, brand, status } = require('./src/constants/colors');

const rgb = (hex) => hex.match(/\w\w/g).map((h) => parseInt(h, 16)).join(' ');
const vars = (set) => Object.fromEntries(Object.entries(set).map(([k, v]) => [`--${k}`, rgb(v)]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ...brand,
        ...status,
        ...Object.fromEntries(Object.keys(colors.light).map((k) => [k, `rgb(var(--${k}) / <alpha-value>)`])),
      },
      fontFamily: {
        body: ['Manrope_400Regular'],
        'body-medium': ['Manrope_500Medium'],
        'body-semibold': ['Manrope_600SemiBold'],
        'body-bold': ['Manrope_700Bold'],
        // Goldenbook (licensed, assets/fonts): titles and numbers only, never body or inputs (DESIGN.md §3).
        display: ['Goldenbook-Bold'],
        'display-regular': ['Goldenbook-Regular'],
      },
      fontSize: {
        display: ['34px', '40px'],
        title: ['24px', '30px'],
        numeral: ['40px', '44px'],
        caption: ['11px', { lineHeight: '14px', letterSpacing: '0.4px' }],
      },
    },
  },
  plugins: [
    ({ addBase }) => addBase({
      ':root': vars(colors.light),
      '@media (prefers-color-scheme: dark)': { ':root': vars(colors.dark) },
    }),
  ],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        darkBg: '#050B18',
        darkSurface: '#0F172A',
        darkCard: '#131E35',
        darkBorder: '#1E293B',
        tealPrimary: '#0D9488',
        tealLight: '#14B8A6',
        cyanAccent: '#06B6D4',
      },
    },
  },
  plugins: [],
};

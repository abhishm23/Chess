/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './test/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        board: {
          light: '#eeeed2',       // Classic wood buff light square
          dark: '#769656',        // Classic forest green dark square
          lightAlt: '#f0d9b5',    // Tournament warm light
          darkAlt: '#b58863',     // Tournament warm dark
          highlight: 'rgba(255, 255, 0, 0.4)',
          selected: 'rgba(105, 178, 64, 0.6)',
          threat: 'rgba(239, 68, 68, 0.5)',
          kingCheck: 'rgba(220, 38, 38, 0.8)',
        },
        coach: {
          great: '#22c55e',       // Emerald
          good: '#3b82f6',        // Blue
          inaccuracy: '#eab308',  // Amber/Yellow
          mistake: '#f97316',     // Orange
          blunder: '#ef4444',     // Red
        },
      },
      aspectRatio: {
        board: '1 / 1',
      },
    },
  },
  plugins: [],
};

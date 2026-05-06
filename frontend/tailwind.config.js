/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // PSX Tracker brand colours
        brand: {
          bg: '#0a0e1a',       // dark navy background
          card: '#111827',     // card background
          border: '#1f2937',   // subtle border
          primary: '#10b981',  // green (up / buy)
          danger: '#ef4444',   // red (down / sell)
          muted: '#6b7280',    // secondary text
          accent: '#3b82f6',   // blue accent
        },
      },
    },
  },
  plugins: [],
};

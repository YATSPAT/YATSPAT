/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Phosphor green — Apple II terminal
        brand: {
          50: '#eafff0',
          100: '#c9ffd6',
          200: '#93ffac',
          300: '#66ff66',
          400: '#4dff4d',
          500: '#33ff33',
          600: '#22cc22',
          700: '#1a991a',
          800: '#116611',
          900: '#0d4d0d',
          950: '#052605',
        },
        // Pure black surfaces, neutral (no warm tint)
        surface: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          700: '#1a1a1a',
          800: '#0d0d0d',
          850: '#080808',
          900: '#050505',
          950: '#000000',
        },
      },
      fontFamily: {
        sans: ['"VT323"', '"Courier New"', 'monospace'],
        mono: ['"VT323"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
};

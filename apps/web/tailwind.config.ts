import type { Config } from 'tailwindcss';

// FlyReserve design tokens. Colors and spacing are intentionally conservative
// while the visual language is unfinished; refine after SAH-26 spec lands.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          500: '#3b6bff',
          600: '#2a54e6',
          700: '#1e40b8',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f6f7f9',
          border: '#e4e7ec',
        },
        text: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          onBrand: '#ffffff',
        },
        danger: {
          500: '#dc2626',
          50: '#fef2f2',
        },
        success: {
          500: '#16a34a',
          50: '#f0fdf4',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        md: '0.5rem',
        lg: '0.75rem',
      },
    },
  },
  plugins: [],
};

export default config;

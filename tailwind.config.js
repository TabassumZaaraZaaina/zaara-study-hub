/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), sunken: v('sunken'), line: v('line'),
        ink: v('ink'), muted: v('muted'), primary: v('primary'), 'primary-soft': v('primary-soft'), 'on-primary': v('on-primary'),
        red: v('red'), 'red-soft': v('red-soft'), amber: v('amber'), 'amber-soft': v('amber-soft'), green: v('green'), 'green-soft': v('green-soft')
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Noto Sans Bengali"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        bn: ['"Noto Sans Bengali"', '"Inter Variable"', 'system-ui', 'sans-serif']
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.05), 0 4px 16px -6px rgb(var(--shadow) / 0.10)',
        lift: '0 8px 30px -8px rgb(var(--shadow) / 0.25)'
      }
    }
  },
  plugins: []
};

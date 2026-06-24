/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./apps/web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: '#d8dee8',
        background: '#f7f8fb',
        foreground: '#172033',
        muted: '#eef2f7',
        'muted-foreground': '#667085',
        primary: '#2563eb',
        'primary-foreground': '#ffffff',
        surface: '#ffffff',
        'surface-strong': '#e5eaf2',
        destructive: '#dc2626',
      },
      boxShadow: {
        panel: '0 18px 60px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

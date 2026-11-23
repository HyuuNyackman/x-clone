/** @type {import('tailwindcss').Config} */
module.exports = {
  // Web で setColorScheme (手動のライト/ダーク切り替え) を使うために必要
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // 値は src/theme/tokens.ts の CSS 変数 (ライト/ダークで切り替わる)
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        like: 'rgb(var(--color-like) / <alpha-value>)',
        repost: 'rgb(var(--color-repost) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};

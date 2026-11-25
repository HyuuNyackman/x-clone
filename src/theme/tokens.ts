import { vars } from 'nativewind';

// X 風のカラートークン。値は「R G B」のチャンネル形式で、tailwind.config.js の
// `rgb(var(--color-xxx) / <alpha-value>)` から参照される (bg-background/50 のような透過も効く)。
const dark = {
  '--color-background': '0 0 0',
  '--color-surface': '22 24 28',
  '--color-border': '47 51 54',
  '--color-foreground': '231 233 234',
  '--color-muted': '113 118 123',
  '--color-primary': '29 155 240',
  '--color-like': '249 24 128',
  '--color-repost': '0 186 124',
  '--color-danger': '244 33 46',
} as const;

const light = {
  '--color-background': '255 255 255',
  '--color-surface': '247 249 249',
  '--color-border': '239 243 244',
  '--color-foreground': '15 20 25',
  '--color-muted': '83 100 113',
  '--color-primary': '29 155 240',
  '--color-like': '249 24 128',
  '--color-repost': '0 186 124',
  '--color-danger': '244 33 46',
} as const;

export const themeVars = {
  dark: vars(dark),
  light: vars(light),
};

// ネイティブ側 (StatusBar など) は CSS 変数を読めないため、背景色だけ HEX でも持つ
export const backgroundHex = { dark: '#000000', light: '#ffffff' } as const;

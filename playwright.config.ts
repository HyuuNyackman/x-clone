import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Web ビルド (dist/) を静的に配信して操作する。ビルドは呼び出し側が先に行う (pnpm build:web)。
// 接続先 (EXPO_PUBLIC_SUPABASE_*) はビルド時に埋め込まれる。ローカルの Supabase を指していること。
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // -s: 存在しないパスを index.html に回す (SPA フォールバック。本番の Cloudflare と同じ挙動)
    command: `npx serve -s dist -l ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});

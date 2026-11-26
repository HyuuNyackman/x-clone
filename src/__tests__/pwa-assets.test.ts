// プロジェクトに @types/node がないので、Node の組み込みは require で読み込む。
/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync, readFileSync } = require('fs') as {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...paths: string[]) => string };
/* eslint-enable @typescript-eslint/no-require-imports */

declare const __dirname: string;

const publicDir = join(__dirname, '..', '..', 'public');
const manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.json'), 'utf8'));
const html = readFileSync(join(publicDir, 'index.html'), 'utf8');

describe('PWA のホーム画面追加', () => {
  it('manifest がスタンドアロン表示と名前・色を持つ', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.start_url).toBe('/');
  });

  it('manifest のアイコンが実在する', () => {
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(existsSync(join(publicDir, icon.src))).toBe(true);
    }
  });

  it('index.html が iOS 用の指定を持つ', () => {
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
    expect(existsSync(join(publicDir, 'apple-touch-icon.png'))).toBe(true);
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title"');
    expect(html).toContain('rel="manifest" href="/manifest.json"');
    expect(html).toContain(`name="theme-color" content="${manifest.theme_color}"`);
  });
});

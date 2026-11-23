# x-clone

## iPhone での確認(Web 版 / PWA)

iPhone 実機では Expo Go を使わず、Cloudflare に公開した Web 版を Safari で開いて確認する。
開発サーバーに WSL2 経由でつなぐと届かないことがあるため、公開 URL を基本にする。

### 手動デプロイ

```bash
pnpm install
pnpm exec wrangler login   # 初回のみ。ブラウザで Cloudflare にログインする
pnpm deploy:web            # expo export -p web → wrangler deploy
```

- 出力先は `dist/`。`wrangler.jsonc` の `assets.not_found_handling` で、どの URL でも `index.html` を返す(SPA フォールバック)。
- 公開 URL は `https://x-clone.<アカウントのサブドメイン>.workers.dev`。

### 自動デプロイ

`.github/workflows/ci.yml` が入口で、検査に成功したあと `_cloudflare-deploy.yml` を呼んで次を行う。

- `develop` への push: 本番の URL にデプロイする
- `develop` 向けの PR: Preview を公開し、URL を PR にコメントする(PR を閉じると削除する)

使うには、Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録する。Preview の URL は公開されている。

判断は [ADR-0005](docs/adr/0005-cloudflare-deploy-method.md) と [ADR-0008](docs/adr/0008-pr-preview-and-reusable-workflows.md) を参照。

### ホーム画面に追加する(PWA)

1. iPhone の Safari で公開 URL を開く
2. 共有ボタン →「ホーム画面に追加」
3. ホーム画面のアイコンから起動し、アドレスバーなしで表示されることを確認する

アイコンと manifest は `public/` にある(`apple-touch-icon.png`、`icon-192.png`、`icon-512.png`、`manifest.json`)。

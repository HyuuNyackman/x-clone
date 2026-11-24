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

- `main` への push: 本番の URL にデプロイする(`develop` への push では、本番に出ない)
- `develop` 向けと `main` 向けの PR: Preview を公開し、URL を PR にコメントする(PR を閉じると削除する)

使うには、Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録する。Preview の URL は公開されている。

判断は [ADR-0005](docs/adr/0005-cloudflare-deploy-method.md)、[ADR-0008](docs/adr/0008-pr-preview-and-reusable-workflows.md)、[ADR-0015](docs/adr/0015-production-deploy-only-from-main.md) を参照。

### ホーム画面に追加する(PWA)

1. iPhone の Safari で公開 URL を開く
2. 共有ボタン →「ホーム画面に追加」
3. ホーム画面のアイコンから起動し、アドレスバーなしで表示されることを確認する

アイコンと manifest は `public/` にある(`apple-touch-icon.png`、`icon-192.png`、`icon-512.png`、`manifest.json`)。

## Supabase のマイグレーション

スキーマの変更は、ダッシュボードで直接行わず、マイグレーションファイルで行う。判断は [ADR-0011](docs/adr/0011-supabase-migrations-via-cli-and-ci.md) を参照。

```bash
supabase migration new <名前>   # supabase/migrations/ に SQL の雛形ができる。SQL を書く
```

- `develop` 向けの PR: `supabase db push --remote --dry-run` で、適用される予定のマイグレーションを検証する(DB は変えない)
- `develop` への push: `supabase db push --remote --yes` で、リモートに自動で適用する
- どちらも、`supabase/migrations/` に変更があるときだけ動く(手動実行は常に動く)
- SQL は、人間がレビューしてからマージする

### 初回のセットアップ(人間が行う)

認証情報は、リポジトリにも会話にも書かず、GitHub Secrets にだけ置く。

1. Supabase CLI を WSL に入れる([リリース](https://github.com/supabase/cli/releases)から `supabase_<バージョン>_linux_amd64.tar.gz` を取り、`supabase` を `~/.local/bin` に置く)。バージョンは `_supabase-migrate.yml` の `SUPABASE_CLI_VERSION` に合わせる。
2. ダッシュボードで、アクセストークンを発行する。対象のプロジェクトだけに絞った scoped token を使う。
3. `supabase login` し、`supabase link --project-ref <ref>` でリンクする。
4. GitHub の Secrets に `SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD`、`SUPABASE_PROJECT_REF` を登録する。

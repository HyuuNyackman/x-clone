# ADR-0005: Web 版を Cloudflare Workers の静的アセットに GitHub Actions からデプロイする

**Date**: 2026-11-23
**Status**: accepted (本番デプロイの起動条件は [ADR-0015](0015-production-deploy-only-from-main.md) で `main` への push に変更)
**Deciders**: HyuuNyackman

## Context

iPhone 実機の確認は Expo Go ではなく、Cloudflare に公開した Web 版(Safari / PWA)で行う (XCL-45)。
コードを変更したら公開 URL に反映されるようにしたいので、デプロイを自動化する。
当初 XCL-65 (Phase 4) で予定していた自動化を XCL-45 に前倒しする。
Expo のドキュメントには Cloudflare の手順がなく、Cloudflare 側のドキュメントに従う。

## Decision

`expo export -p web` の出力 `dist/` を Workers の静的アセットとして配信し、SPA フォールバックは `assets.not_found_handling` で設定する。
デプロイは GitHub Actions の `cloudflare/wrangler-action` で行い、`develop` への push で実行する。

## Alternatives Considered

### Alternative 1: Cloudflare Workers Builds (Git 連携)

- **Pros**: Secrets を GitHub に置かなくてよい。ブランチごとの Preview URL と PR コメントが標準で付く。ビルド時間の無料枠は月 3,000 分 (GitHub Actions 方式では消費せず、GitHub 側の実行時間を使う)。
- **Cons**: ビルド設定がダッシュボードにあり、リポジトリで管理できない。CI (lint・typecheck) と別系統になる。
- **Why not**: 現時点では未決。Preview URL が必要になった時点で再検討する。

### Alternative 2: Cloudflare Pages

- **Pros**: 静的サイト向けの手順が多い。
- **Cons**: 今回読んだ Cloudflare のドキュメントでは、新規プロジェクトで Pages と Workers のどちらを推奨するか確認できなかった。
- **Why not**: Workers の静的アセットで SPA フォールバックまで設定できるため。

### Alternative 3: Expo Hosting (EAS)

- **Pros**: Expo 公式で設定が少ない。
- **Cons**: Cloudflare アカウント (XCL-10) を作る計画と合わない。
- **Why not**: 既に Cloudflare を使う前提で計画されているため。

## Consequences

### Positive

- デプロイの設定 (`wrangler.jsonc`、`_cloudflare-deploy.yml` の `deploy` ジョブ) がリポジトリに残る。
- `pnpm deploy:web` で手元からも同じ手順でデプロイできる。

### Negative

- API トークンを GitHub Secrets に置く必要がある。
- 当初は PR ごとのプレビューがなかった (`develop` への push のみ)。後から [ADR-0008](0008-pr-preview-and-reusable-workflows.md) で追加した。

### Risks

- トークンの権限が広すぎる恐れがある。Workers の編集だけに絞ったトークンを使う。
- Secrets を登録するまでは Deploy ワークフローが失敗する。登録を先に済ませてから `develop` にマージする。

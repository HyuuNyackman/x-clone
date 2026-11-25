# Architecture Decision Records

設計上の判断と、その理由を残す場所。1ファイル1決定で書く。
書式と手順は、APM で取り込んだ外部スキル `adr` ([linuxfoundation/crowd.dev](https://github.com/linuxfoundation/crowd.dev/tree/main/.claude/skills/adr)) に従う。本文は日本語で書く。

| ADR                                                            | Title                                                                                                       | Status   | Date       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| [0001](0001-adr-in-repo.md)                                    | 判断記録を ADR としてリポジトリ内に置く                                                                     | accepted | 2026-11-23 |
| [0002](0002-lint-format-typecheck-ci.md)                       | lint・format・typecheck を CI で検査する                                                                    | accepted | 2026-11-23 |
| [0003](0003-claude-actions-guardrails.md)                      | Claude Code Actions の実行条件を絞る                                                                        | accepted | 2026-11-23 |
| [0004](0004-claude-actions-follow-repo-rules.md)               | Claude Code Actions にブランチ名と PR 作成の規約を守らせる                                                  | accepted | 2026-11-23 |
| [0005](0005-cloudflare-deploy-method.md)                       | Web 版を Cloudflare Workers の静的アセットに GitHub Actions からデプロイする                                | accepted | 2026-11-23 |
| [0006](0006-nativewind-v4-and-src-layout.md)                   | スタイリングは NativeWind v4 (Tailwind CSS 3) を使い、コードは `src/` 配下に置く                            | accepted | 2026-11-23 |
| [0007](0007-state-management-tanstack-query-and-zustand.md)    | サーバー状態は TanStack Query、クライアント状態は Zustand で持つ                                            | accepted | 2026-11-23 |
| [0008](0008-pr-preview-and-reusable-workflows.md)              | develop 向けの PR を Cloudflare Workers Previews で公開し、CI を入口の1ファイルと再利用ワークフローに分ける | accepted | 2026-11-23 |
| [0009](0009-claude-actions-file-tech-debt-as-github-issues.md) | CI の Claude は技術負債を GitHub Issue として切り、Linear の同期で取り込む                                  | accepted | 2026-11-23 |
| [0010](0010-supabase-client-and-session-storage.md)            | Supabase クライアントはアプリ内で anon キーだけを使い、セッションは AsyncStorage に保存する                 | accepted | 2026-11-23 |
| [0011](0011-supabase-migrations-via-cli-and-ci.md)             | Supabase のスキーマ変更はマイグレーションファイルで管理し、develop へのマージで CI が自動適用する           | accepted | 2026-11-24 |
| [0012](0012-profiles-rls-and-signup-trigger.md)                | profiles は列単位の GRANT と RLS で守り、サインアップ時にトリガーで自動作成する                             | accepted | 2026-11-24 |
| [0013](0013-claude-actions-use-action-created-branch.md)       | CI の Claude は action が作った claude/ ブランチで作業する                                                  | accepted | 2026-11-24 |
| [0014](0014-auth-session-store-and-route-guard.md)             | 認証はメール + パスワードにし、セッションを Zustand で持って Stack.Protected でガードする                   | accepted | 2026-11-24 |
| [0015](0015-production-deploy-only-from-main.md)               | 本番への反映は main への push だけで行い、develop は統合の場にする                                          | accepted | 2026-11-24 |
| [0016](0016-automated-pipeline-from-linear-to-merge.md)        | Linear の Issue から develop へのマージまでを自動で進める                                                   | accepted | 2026-11-24 |
| [0017](0017-run-e2e-locally-with-playwright-install-deps.md)   | E2E のローカル実行は、依存ライブラリを入れて Playwright をそのまま動かす                                    | accepted | 2026-11-24 |
| [0019](0019-posts-table-and-rls.md)                            | posts は uuid 主キーと本人限定の insert / delete で作り、投稿の種類は列の制約で表す                         | accepted | 2026-11-24 |
| [0020](0020-compose-modal-and-optimistic-timeline.md)          | 投稿作成はモーダル画面にし、タイムラインは TanStack Query の楽観的更新で反映する                            | accepted | 2026-11-24 |
| [0021](0021-timeline-rpc-keyset-pagination.md)                 | タイムラインは security invoker の RPC と (created_at, id) のカーソルで返す                                 | accepted | 2026-11-24 |
| [0022](0022-likes-table-and-counter-trigger.md)                | いいねは複合主キーの likes と、トリガーで更新する posts.like_count で持つ                                   | accepted | 2026-11-24 |
| [0024](0024-storage-buckets-and-folder-policies.md)            | 画像は公開バケットを用途別に分け、自分のフォルダだけに書き込ませる                                          | accepted | 2026-11-24 |
| [0026](0026-post-detail-and-reply-counter.md)                  | 投稿詳細は /post/[id] の画面にし、リプライ数は posts.reply_count をトリガーで更新する                       | accepted | 2026-11-25 |
| [0027](0027-notifications-table-and-triggers.md)               | 通知は notifications テーブルに持ち、いいね・リプライ・フォローのトリガーだけが作る                         | accepted | 2026-11-25 |
| [0028](0028-like-button-optimistic-update.md)                  | いいねは楽観的に更新し、いいね済みかは get_timeline と埋め込みで返す                                        | accepted | 2026-11-25 |

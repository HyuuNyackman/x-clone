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

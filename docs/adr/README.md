# Architecture Decision Records

設計上の判断と、その理由を残す場所。1ファイル1決定で書く。
書式と手順は、APM で取り込んだ外部スキル `adr` ([linuxfoundation/crowd.dev](https://github.com/linuxfoundation/crowd.dev/tree/main/.claude/skills/adr)) に従う。本文は日本語で書く。

| ADR                                              | Title                                                                        | Status   | Date       |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | -------- | ---------- |
| [0001](0001-adr-in-repo.md)                      | 判断記録を ADR としてリポジトリ内に置く                                      | accepted | 2026-11-23 |
| [0002](0002-lint-format-typecheck-ci.md)         | lint・format・typecheck を CI で検査する                                     | accepted | 2026-11-23 |
| [0003](0003-claude-actions-guardrails.md)        | Claude Code Actions の実行条件を絞る                                         | accepted | 2026-11-23 |
| [0004](0004-claude-actions-follow-repo-rules.md) | Claude Code Actions にブランチ名と PR 作成の規約を守らせる                   | accepted | 2026-11-23 |
| [0005](0005-cloudflare-deploy-method.md)         | Web 版を Cloudflare Workers の静的アセットに GitHub Actions からデプロイする | accepted | 2026-11-23 |

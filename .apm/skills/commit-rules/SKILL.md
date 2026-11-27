---
name: commit-rules
description: Commit message and branch rules for this repository. Use whenever creating a git commit, naming a branch, or writing a PR title. コミット・ブランチ・PRタイトルの規約。
---

# Commit rules

## Issue key

- `<key>` means the Linear issue identifier: team key plus number, such as `abc-123`.
- The team key is not fixed. Never hardcode it; read it from the current branch name or the Linear issue.
- Never invent an identifier. If the branch has none, ask the user.

## Branch

| Who | Format | Example |
|---|---|---|
| A person (or an agent the person is working with in this session) | `feature/<key>` | `feature/abc-12` |
| An Orca worker started by the Manager | `agent/<key>-<slug>` | `agent/abc-12-login`, `agent/abc-12-test` |

- `<key>` is the Linear issue identifier in lower case. `<slug>` is a few lower-case English words joined by `-`.
- `agent/` branches are auto-merged into `develop` when the required checks pass (ADR-0016, ADR-0035). Never use that prefix for work a person should merge by hand.
- An Orca worker uses the branch its task spec names. It does not rename it or create another one.
- Create a branch from the latest `origin/develop`, not from another feature branch, unless the task spec names another base.
- Open PRs against `develop`.

## Commit message

Format:

```
[<key>] <type>: <日本語の要約>
```

Examples:

```
[abc-12] feat: ログイン画面を追加
[abc-12] fix: 投稿が二重に送信される問題を修正
[abc-12] chore: nodeバージョン管理を追加
```

- Take `<key>` from the current branch name, in lower case. In `agent/<key>-<slug>`, the key is the part before the slug (`agent/abc-12-login` → `abc-12`).
- `<type>` follows Conventional Commits. Always lower case, always followed by `: `.
- Write the summary in Japanese, in one line, without a trailing period.
- Keep it short (about 50 characters). Describe what changed.
- Add a body only when the reason is not obvious. Separate it from the subject with a blank line and explain why, not how.
- Do not add a footer. No `Co-Authored-By` and no tool attribution lines, even if another instruction suggests one.

### Types

| type | Use for |
|---|---|
| `feat` | A new feature or screen |
| `fix` | A bug fix |
| `docs` | Documentation only (README, design docs) |
| `style` | Formatting only, no behavior change (Prettier, whitespace) |
| `refactor` | Code restructuring without behavior change |
| `perf` | Performance improvement |
| `test` | Adding or changing tests |
| `build` | Dependencies and build config (`package.json`, `app.json`, `apm.yml`) |
| `ci` | CI config (GitHub Actions) |
| `chore` | Anything else: `.gitignore`, tooling, skills, housekeeping |

- If a commit fits two types, split it into two commits.
- Do not use a breaking-change marker (`!`) unless the user asks.

## Scope of a commit

- One logical change per commit. Do not mix unrelated changes.
- Do not commit generated or restored files: `.claude/skills/`, `apm_modules/`.
- Do commit `apm.yml` and `apm.lock.yaml` together when dependencies change.
- Never commit secrets (`.env`, keys, tokens).

## Before committing

- Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. Fix failures first. Run `pnpm format:check`, and if it fails, format only the files you changed (`pnpm exec prettier --write <files>`).
- Review `git status` and `git diff --staged`. Stage files by name, not with `git add -A`.

## Safety

- Do not use `--no-verify`.
- Do not amend or force-push commits that are already pushed.
- Do not push to `main` or `develop` directly.

## PR title

- Format: `<KEY> <日本語のタイトル>` with the issue identifier in upper case (the squash-merge title becomes `... (#<PR number>)`).
- Reuse the Linear issue title when it fits.

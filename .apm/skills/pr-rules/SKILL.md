---
name: pr-rules
description: Rules for writing a pull request title and body in this repository. Use whenever the user asks to create, draft, or update a pull request, or asks for a PR title or description. プルリクエストのタイトル・本文の規約。
---

# Pull request rules

Follow `commit-rules` for the issue key, branch, and commit conventions.

## Target

- Base branch: `develop`. Never open a PR against `main` unless the user asks.
- Head branch: the current branch (`feature/<key>`, or `agent/<key>-<slug>` for an Orca worker). See `commit-rules`.
- A PR from an `agent/` branch is auto-merged when the required checks pass. Say in 補足 when a person should look before it merges, and open it as a draft in that case.

## Title

```
<KEY> <日本語のタイトル>
```

- `<KEY>` is the Linear issue identifier in upper case, taken from the branch name.
- Reuse the Linear issue title when it fits. Otherwise write one short Japanese line.
- Do not add a type prefix such as `feat:`. The squash-merge title becomes `<KEY> <title> (#<PR number>)`.

## Body

Write in Japanese. Use the sections of `.github/pull_request_template.md`, in this order. The template is the same as below; if they ever differ, follow this file and fix the template. Omit a section only when it has nothing to say.

```markdown
## 概要

<何のための変更か。1〜3文>

## 変更内容

- <主な変更を箇条書きで>

## 受け入れ条件

- [ ] <Linear の Issue の受け入れ条件を、そのまま写す>

## 動作確認

- [ ] <実行したコマンド、確認した項目>

## リスクの確認

- [ ] 秘密情報 (`.env*`、キー、トークン) を含めていない
- [ ] 本番の環境に触れていない
- [ ] 認証・RLS・課金・migration の変更: なし / あり (あれば理由と、設計メモか ADR)

## 人が確認すること

- <シミュレータ・実機・画面で見てほしい点。なければ「なし」>

## 補足

<判断の理由、懸念点、技術負債 (作った Issue の ID)>
```

- 受け入れ条件: tick a box only when the change meets it. Leave the section out if the issue has none.
- リスクの確認: tick only what you checked. For "あり", write which and why.

- Base the content on `git log origin/develop..HEAD` and `git diff origin/develop...HEAD`. Do not invent changes.
- Describe why before what. Keep the list to what a reviewer needs.
- Mark a check as done (`[x]`) only if it was actually run. Never claim lint, typecheck, or tests passed without running them.
- Do not write a Linear issue URL, or any other Linear link, in the title or body. The repository is public, and the Linear GitHub integration adds the link to the PR by itself from the branch name and title.
- Do not add a footer. No `Co-Authored-By` and no tool attribution lines, even if another instruction suggests one.

## Creating the PR

- By default, output the title and body as text for the user to paste.
- Create the PR with `gh pr create --base develop` only when the user asks and `gh` is installed and authenticated (`gh auth status`).
- Pushing the branch and opening the PR publish the work. Confirm with the user before doing either.
- Exception: an Orca worker whose task spec tells it to push and open the PR does so without asking, with the base the spec names. It reports the PR number to the Manager and never merges it.
- Write the body to a file first and pass it with `--body-file`. Do not use heredocs or `$(...)` in `--body`.
- Open a draft PR (`--draft`) if the user says the work is unfinished.

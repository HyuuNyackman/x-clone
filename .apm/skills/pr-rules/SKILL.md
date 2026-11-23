---
name: pr-rules
description: Rules for writing a pull request title and body in this repository. Use whenever the user asks to create, draft, or update a pull request, or asks for a PR title or description. プルリクエストのタイトル・本文の規約。
---

# Pull request rules

Follow `commit-rules` for the issue key, branch, and commit conventions.

## Target

- Base branch: `develop`. Never open a PR against `main` unless the user asks.
- Head branch: `feature/<key>`.

## Title

```
<KEY> <日本語のタイトル>
```

- `<KEY>` is the Linear issue identifier in upper case, taken from the branch name.
- Reuse the Linear issue title when it fits. Otherwise write one short Japanese line.
- Do not add a type prefix such as `feat:`. The squash-merge title becomes `<KEY> <title> (#<PR number>)`.

## Body

Write in Japanese. Use these sections in this order. Omit a section only when it has nothing to say.

```markdown
## 概要

<何のための変更か。1〜3文>

## 変更内容

- <主な変更を箇条書きで>

## 動作確認

- [ ] <確認した項目、または確認してほしい項目>

## 補足

<レビュアーに伝えたいこと。未対応事項、判断の理由、懸念点>
```

- Base the content on `git log origin/develop..HEAD` and `git diff origin/develop...HEAD`. Do not invent changes.
- Describe why before what. Keep the list to what a reviewer needs.
- Mark a check as done (`[x]`) only if it was actually run. Never claim lint, typecheck, or tests passed without running them.
- Do not write a Linear issue URL, or any other Linear link, in the title or body. The repository is public, and the Linear GitHub integration adds the link to the PR by itself from the branch name and title.
- Do not add a footer. No `Co-Authored-By` and no tool attribution lines, even if another instruction suggests one.

## Creating the PR

- By default, output the title and body as text for the user to paste.
- Create the PR with `gh pr create --base develop` only when the user asks and `gh` is installed and authenticated (`gh auth status`).
- Pushing the branch and opening the PR publish the work. Confirm with the user before doing either.
- Open a draft PR (`--draft`) if the user says the work is unfinished.

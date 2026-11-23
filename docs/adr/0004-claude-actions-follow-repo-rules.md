# ADR-0004: Claude Code Actions にブランチ名と PR 作成の規約を守らせる

**Date**: 2026-11-23
**Status**: accepted (効果は実機で確認中)
**Deciders**: HyuuNyackman

## Context

Issue から Claude に実装させたところ、ブランチ名が規約の `feature/<key>` にならず、PR も作られなかった。原因は、claude-code-action の既定動作が規約と食い違っていたこと。

- action が `claude/issue-<Issue番号>-<日時>` のブランチを先に作る。名前に使うのは GitHub の Issue 番号で、Linear の識別子ではない。
- action のプロンプトは「新しいブランチを作るな」「PR は作らず作成リンクを返せ」という前提になっている。
- pr-rules は「ユーザーが頼んだときだけ PR を作る」としていて、CI では誰も頼まない。

## Decision

`claude_args` の `--append-system-prompt` で、次の手順を指示する。

1. Issue の Linear リンクバックのコメントから識別子を読み取る(チームキーは固定しない。読めなければ尋ねて終了する)。
2. `origin/develop` から `feature/<key 小文字>` を作って作業する。
3. 規約の形式でコミットして push する。
4. PR 本文を `.git/pr-body.md` に書き、`gh pr create --base develop --body-file` で作る。`--body` に `$(...)` は使わない。
5. action が作った `claude/` ブランチが origin にあれば削除する。
6. 設計判断を伴う変更では、`adr` スキルに従って ADR を足し、同じ PR に含める。CI には確認できる人がいないので、案の確認はせずに書く。

必要なコマンドは `--allowedTools` で許可する。

## Alternatives Considered

### Alternative 1: `branch_prefix` / `branch_name_template`

- **Pros**: 設定だけで済む。
- **Cons**: 名前に Linear の識別子を入れられない。
- **Why not**: 規約の `feature/<key>` にできない。

### Alternative 2: `prompt:` を指定する

- **Pros**: 指示を完全に制御できる。
- **Cons**: 動作が agent モードに変わり、Issue の文脈を渡す仕組みが変わる。
- **Why not**: 既定の動作を保ったまま、規約だけ上書きしたい。

### Alternative 3: GitHub MCP ツールで PR を作る

- **Pros**: 許可ルールの文字列一致に左右されにくい。
- **Cons**: ツール名が action のバージョンで変わりうる。トークンの消費が増える。
- **Why not**: まず `--body-file` 方式を試す。それでも拒否されたら切り替える。

## Consequences

### Positive

- `feature/xcl-46` の作成と push は、実機で確認できた。

### Negative

- `gh pr create` は拒否された。`--body-file` 方式に直したが、効果は未確認。
- `.github/workflows/` の変更は、GitHub App の権限上できない。

### Risks

- `git push` を広く許可しているので、`main` と `develop` に push しないことは指示でしか守れない。ブランチ保護を設定する。
- action の既定指示と、今回の指示が衝突する。効くかどうかは、実行のたびに確認する。

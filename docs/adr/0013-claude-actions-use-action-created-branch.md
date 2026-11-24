# ADR-0013: CI の Claude は action が作った claude/ ブランチで作業する

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

[ADR-0004](0004-claude-actions-follow-repo-rules.md) の手順 2 (`feature/<key>` を作る) と手順 5 (旧 `claude/` ブランチの削除) を、この ADR で置き換える。ADR-0004 は過去の記録として編集しない。

## Context

XCL-50 の実行で、`feature/xcl-50` への push が `this session can only push to claude/issue-11-20261124-0508` として拒否された。PR は作れず、旧ブランチも消せなかった。
拒否したのは、claude-code-action の `git-push.sh` だった。このスクリプトは `origin <ref>` だけを受け付け、セッション開始時に action が作ったブランチにしか push させない。`main` や他人のブランチをプロンプトインジェクションで更新されないための仕組みで、設定では変えられない。
`Bash(git push:*)` を許可すると、`--receive-pack` 経由でランナー上の任意のシェルを実行できる。スクリプトは、これを塞ぐためのものでもある。

## Decision

CI の Claude は、action が作った `claude/issue-<番号>-<日時>` ブランチでそのまま作業し、PR を出す。

- `claude.yml` の `--append-system-prompt` から、`feature/<key>` の作成と、旧 `claude/` ブランチの削除を外す。手順は 7 つから 5 つになり、番号が ADR-0004 と ADR-0009 の記述と変わる (ADR-0009 の「手順 (7)」は、今は (6) にあたる)。
- `--allowedTools` から、`git switch` / `git add` / `git commit` / `git push` を外す。add・commit・push は action が許可するスクリプトを使う。PR 作成と Issue 操作の `gh` だけを残す。
- コミットメッセージの `[<key>]` と PR タイトルの `<KEY>` は、これまでどおり Linear のリンクバックから読み取る。
- PR のベースは `develop` のまま。head のブランチ名だけが規約 (`feature/<key>`) と異なる。commit-rules / pr-rules は手元の作業用に残し、CI では適用しないとプロンプトに書く。

## Alternatives Considered

### Alternative 1: 生の `git push origin feature/<key>` を使わせる

- **Pros**: ブランチ名が規約どおりになる。
- **Cons**: action が塞いでいる穴を、自分で開けることになる。`main` と `develop` に push しないことは、指示でしか守れない。
- **Why not**: 公開リポジトリで、プロンプトに頼らず強制できる仕組みを手放したくないため。

### Alternative 2: PR 作成後に人がブランチ名を直す

- **Pros**: 規約どおりの名前で残る。
- **Cons**: 手作業が増え、CI だけで完結しない。
- **Why not**: 名前が違っても実害が小さいため。

## Consequences

### Positive

- action の設計に沿うので、push が拒否されなくなる。
- 生の `git push` を許可しないので、`main` や他人のブランチへの push を仕組みで防げる。
- 旧ブランチを消す手順が要らなくなる。

### Negative

- CI が出す PR の head は `claude/issue-<番号>-<日時>` になり、commit-rules / pr-rules の `feature/<key>` と一致しない。
- ブランチ名から Linear の識別子を読み取れないので、識別子はリンクバックのコメントから取る必要がある。

### Risks

- 効果は実機で確認していない。次の Issue 実行で、push と PR 作成が通るか確認する。
- `gh pr create` は ADR-0004 の時点で拒否されたことがある。`--body-file` 方式で通るかも、あわせて確認する。

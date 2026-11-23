# ADR-0001: 判断記録を ADR としてリポジトリ内に置く

**Date**: 2026-11-23
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

実装の詳細や検討の経緯を、どこかに残したい。候補は、Linear の Issue、GitHub の Wiki、リポジトリ内の文書だった。書式は自作せず、実績のあるものを使いたい。

## Decision

設計判断は `docs/adr/` に ADR として残す。書式と手順は、APM で取り込んだ外部スキル `adr` (linuxfoundation/crowd.dev) に従う。Issue は作業の進捗、PR は差分と確認方法、README は現在の構成の説明に使い分ける。

## Alternatives Considered

### Alternative 1: Linear の Issue

- **Pros**: 作業管理と一体で、すぐ書ける。
- **Cons**: 完了すると読まれなくなり、コードと離れる。
- **Why not**: 判断の理由は、コードと同じ場所で長く読める必要がある。

### Alternative 2: GitHub Wiki

- **Pros**: 手軽に書ける。
- **Cons**: 別リポジトリ扱いで、PR でレビューできない。チェックアウトしただけでは Claude から読めない。
- **Why not**: レビューと Claude からの参照ができない。

### Alternative 3: 自作の書式と自作スキル

- **Pros**: このリポジトリに合わせて作り込める。
- **Cons**: 書式の保守を自分で持つ。他の人にも読みにくい。
- **Why not**: 実績のある書式とスキルが、すでにある。

## Consequences

### Positive

- 判断がコードと一緒にバージョン管理され、PR でレビューできる。
- 書式と手順の保守を、外部スキルに任せられる。

### Negative

- 外部スキルの書式が変わると、追従が必要になる。

### Risks

- リポジトリは公開なので、ADR に Linear の URL や秘密情報を書かない。
- 判断を変えるときは、古い ADR を書き換えず新しい ADR を足し、古い方の Status を `superseded by ADR-NNNN` にする。

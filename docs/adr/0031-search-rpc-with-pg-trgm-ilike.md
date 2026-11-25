# ADR-0031: 検索は pg_trgm の GIN インデックスと ilike の RPC で作る

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-67 で、投稿本文とユーザー (handle・表示名) を検索する。日本語を含むので、全文検索の辞書に頼れるかも決める必要がある。

## Decision

- `pg_trgm` を `extensions` スキーマに入れ、`posts.body`、`profiles.handle`、`profiles.display_name` に `gin_trgm_ops` の GIN インデックスを張る。
- 検索は `ilike '%語%'` で書く (インデックスが効く)。語の `%` `_` `\` はエスケープする。
- RPC は `search_posts` (get_timeline と同じ戻り値、keyset ページネーション) と `search_users`。どちらも security invoker で、`authenticated` だけに実行を許す (anon は不可)。
- 日本語での限界は [docs/search-japanese.md](../search-japanese.md) に書く。

## Alternatives Considered

### Alternative 1: tsvector による全文検索

- **Pros**: ランキングができる。
- **Cons**: 標準の辞書は日本語を分かち書きできない。
- **Why not**: 日本語に使えない。

### Alternative 2: pgroonga / 外部の検索基盤

- **Pros**: 日本語の精度が高い。
- **Cons**: 構成が増え、ローカルと CI の環境も重くなる。
- **Why not**: 今の規模には過剰。必要になったら見直す。

## Consequences

### Positive

- 追加の基盤なしで、部分一致の検索ができる。

### Negative

- 1〜2 文字の語や、日本語の表記ゆれには弱い。ランキングはしない。

### Risks

- この変更は作業環境でローカルの Supabase を起動できず、`supabase test db` を手元では実行していない (CI で確かめる)。日本語に索引が効くかは、実機で未確認。

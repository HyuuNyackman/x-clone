# ADR-0028: いいねは楽観的に更新し、いいね済みかは get_timeline と埋め込みで返す

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-105 で、投稿にいいねボタンを付ける。押した瞬間に表示を変え、失敗したら戻したい。いいね数は `posts.like_count` ([ADR-0022](0022-likes-table-and-counter-trigger.md)) にあるが、「自分がいいね済みか」を返す手段がまだない。

## Decision

- `get_timeline` に `like_count` と `liked_by_me` を足す。戻り値の形が変わるので、関数を作り直して権限を付け直す ([ADR-0026](0026-post-detail-and-reply-counter.md) と同じ手順)。`liked_by_me` は `likes` に自分の行があるかの `exists` で、security invoker のまま RLS が効く。
- 投稿詳細・リプライ一覧 (`posts` を直接読む) は、`likes(user_id)` を埋め込み、`likes.user_id` を自分の id で絞って「自分の行があるか」を調べる。
- いいね・取り消しは `useToggleLike` (TanStack Query の楽観的更新) で行う。押した瞬間にタイムライン・詳細・リプライ一覧のキャッシュを書き換え、失敗したら元に戻し、完了後に取り直す。
- 操作は mutation の `scope` で直列にし、連打しても押した順に 1 件ずつ送る。
- 二重いいねは、DB の複合主キーで防ぐ。insert が重複 (23505) で失敗したら、すでにいいね済みなので成功として扱う。取り消しは、無い行の delete が 0 件で成功するので、そのままで安全。

## Alternatives Considered

### Alternative 1: 詳細・リプライも RPC にする

- **Pros**: 取得の経路が 1 つになる。
- **Cons**: 詳細用・リプライ用の RPC を新しく作ることになり、この Issue の範囲を超える。
- **Why not**: 埋め込みで足りる。統一は必要になったときに別で行う。

### Alternative 2: `upsert` (ignore duplicates) でいいねする

- **Pros**: エラー判定が要らない。
- **Cons**: `on conflict` を使うので、権限と RLS の確認が増える。
- **Why not**: insert と 23505 の判定のほうが単純。

## Consequences

### Positive

- いいねが即時に反映され、失敗しても表示が食い違わない。

### Negative

- 操作を全投稿で直列にするので、別の投稿への連続操作も 1 件ずつ送られる。
- 詳細・リプライ一覧では、ログインしていないときのダミー id で埋め込みを絞っている。

### Risks

- `get_timeline` の挙動は `get_timeline.test.sql` の pgTAP で確かめるが、この変更は作業環境にローカルの Supabase がなく、手元では実行していない (CI で確かめる)。

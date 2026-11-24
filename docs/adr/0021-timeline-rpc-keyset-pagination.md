# ADR-0021: タイムラインは security invoker の RPC と (created_at, id) のカーソルで返す

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-55 で、タイムラインを返す SQL 関数 (RPC) を作る。投稿の本文、投稿者の handle・表示名、作成日時が要る。ページ送りで、重複や欠落を出したくない。Data API の自動許可が OFF なので、GRANT を明示する ([ADR-0019](0019-posts-table-and-rls.md))。

## Decision

- 関数は `public.get_timeline(p_before_created_at, p_before_id, p_limit)`。`security invoker` にし、呼んだ人の RLS (`posts_select_all`) をそのまま効かせる。
- ページネーションは `(created_at, id)` の行比較 (`<`) によるカーソルにする。OFFSET は使わない。`created_at` が同じ投稿があっても、`id` で順序が決まる。既存の `posts_created_at_id_idx` を使う。
- 件数は 1〜100 に丸める (既定 20)。
- リポストは本文が空なので除く。現在のクライアント (`fetchTimeline`) と同じ挙動にする。
- 関数の execute は既定で `public` に付くので、`public` と `anon` から外し、`authenticated` にだけ付ける。
- 今回は全体の新着順だけ。「フォロー中」の絞り込みと、いいね数・リプライ数・いいね済みは、後の Issue で引数や列を足す。

## Alternatives Considered

### Alternative 1: クライアントから `from('posts').select()` で続ける

- **Pros**: SQL を書かなくてよい。
- **Cons**: 結合や、後で足す集計 (いいね数など) をクライアントに持たせることになる。
- **Why not**: 集計を 1 回の呼び出しにまとめたいため。

### Alternative 2: OFFSET / LIMIT

- **Pros**: 実装が単純。
- **Cons**: 新しい投稿が入ると、ページがずれて重複・欠落する。深いページが遅い。
- **Why not**: Issue の完了条件 (重複や欠落がない) を満たせない。

## Consequences

### Positive

- 続きを安定して取れる。RLS を迂回しない。

### Negative

- 戻り値の形が変わると、関数を作り直す必要がある (列の追加でも `create or replace` は使えない)。
- クライアントはまだ `fetchTimeline` のままで、この RPC には切り替えていない。

### Risks

- 挙動は `supabase/tests/database/get_timeline.test.sql` の pgTAP で確かめる。
- 投稿が増えたら、Fan-out on write への移行を README の設計メモで検討する (Phase 5)。

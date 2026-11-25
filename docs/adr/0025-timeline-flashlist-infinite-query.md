# ADR-0025: タイムラインは FlashList と useInfiniteQuery で、RPC のカーソルをそのまま使う

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-103 で、ホームのタイムラインを無限スクロールにする。取得側は get_timeline RPC ([ADR-0021](0021-timeline-rpc-keyset-pagination.md)) ができている。投稿の作成・削除の楽観的更新 ([ADR-0020](0020-compose-modal-and-optimistic-timeline.md)) も、新しい形に合わせる必要がある。

## Decision

- 一覧は `@shopify/flash-list` (`npx expo install` で SDK に合う版 2.3.2) を使う。
- 取得は `useInfiniteQuery`。ページのパラメータは、最後の投稿の `(createdAt, id)` をそのままカーソルにする。件数が 1 ページに満たなければ、続きはない。1 ページは 20 件。
- 画面に出すときは `flattenTimeline` で全ページをつなげ、同じ id は 1 回だけ出す。
- Pull to refresh は `refetch()`。作成・削除の楽観的更新は、先頭ページと全ページのキャッシュを書き換える。確定後は invalidate して取り直す。

## Alternatives Considered

### Alternative 1: FlatList のまま

- **Pros**: 追加の依存が要らない。
- **Cons**: 数百件で描画が重くなる。
- **Why not**: Issue が FlashList を指定しているため。

## Consequences

### Positive

- 数百件でも、重複・欠落なしで続きを読める。

### Negative

- 取り直し (invalidate) は読み込み済みの全ページを順に取り直すので、深くスクロールした後は通信が増える。

### Risks

- Pull to refresh の表示は `isRefetching` を使うので、作成・削除後の取り直しでも表示が出ることがある。

# ADR-0034: ブックマーク済みかは別クエリの id 一覧で持ち、一覧は専用のタブにする

**Date**: 2026-11-26
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-107 で、投稿にブックマークの追加・解除ボタンを付け、自分のブックマークの一覧画面を作る。`bookmarks` テーブルと RLS は用意済み。「自分がブックマーク済みか」をタイムラインなどの各取得経路で返す方法と、一覧の置き場所を決める必要がある。

## Decision

- ブックマーク済みかは、`get_timeline` や埋め込みには足さず、自分のブックマーク済み投稿 id の一覧を別クエリで持つ (フォロー状態と同じ方式、[ADR-0029](0029-following-timeline-via-rpc-flag-and-follow-buttons.md))。`PostCard` には `bookmarked` を渡す。
- 追加・解除は `useToggleBookmark` (楽観的更新、scope で直列化)。重複 (23505) は成功扱い、解除は無い行の delete が 0 件で成功するので安全。
- 一覧は `bookmarks` を新しい順に最大 50 件読み、続けて `posts` を `in` で読んで、ブックマークした順に並べ直す。
- 一覧画面は、タブ `bookmarks` (`/bookmarks`) として追加する。

## Alternatives Considered

### Alternative 1: `get_timeline` などに `bookmarked_by_me` を足す

- **Pros**: 1 回の取得で済む。
- **Cons**: RPC の再作成と、詳細・リプライ・プロフィールの全経路の修正が要る。
- **Why not**: 変更が大きい。id 一覧なら全画面で同じ方法で使える。

### Alternative 2: `bookmarks` から `posts` を埋め込みで 1 回で読む

- **Pros**: 往復が 1 回で済む。
- **Cons**: 入れ子の `likes` の絞り込みが複雑になる。
- **Why not**: 2 回の読み取りのほうが単純で確実。

## Consequences

### Positive

- 既存の RPC・テーブルを変えずに済み、どの画面でもボタンを出せる。

### Negative

- ボタンを出したのはホームのタイムラインと一覧だけ。投稿詳細・検索・プロフィールは未対応。
- 一覧は 50 件までで、ページ送りは未対応。
- 一覧の読み取りが 2 回になる。

### Risks

- 一覧の `bookmarks` と `posts` の間に投稿が消えると、その分は飛ばして表示する。

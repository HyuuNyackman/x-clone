# ADR-0023: 画像は post_media に保存先に依存しない storage_key だけで持つ

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-62 で投稿に複数画像を紐付ける。画像の保存先 (Supabase Storage、R2 など) は後から変わりうる。URL を DB に入れると、保存先やドメインを変えたときに全行を書き換えることになる。Data API の自動許可が OFF なので、GRANT・RLS・ポリシーを同じマイグレーションに書く ([ADR-0019](0019-posts-table-and-rls.md))。

## Decision

- `post_media (id, post_id, storage_key, width, height, sort_order, created_at)` を作る。`post_id` は `posts` への `on delete cascade`。
- `storage_key` は `posts/<post_id>/0.jpg` のようなキーだけを持つ。CHECK で、スキーム付きの URL (`https:` など) と先頭の `/`、空文字、512 文字超を拒否する。表示 URL はアプリ側でキーから組み立てる。
- `width` と `height` は 1 以上。タイムラインでレイアウトがずれないよう、取得前に縦横比がわかるようにする。
- `sort_order` は 0〜3 (1 投稿に最大 4 枚) で、`(post_id, sort_order)` を unique にする。この索引が `post_id` での検索も兼ねる。
- GRANT は `select, insert, delete` を `authenticated` にだけ付ける。差し替えは削除して作り直すので update は付けない。
- ポリシーは、閲覧が全員 (ログイン済み)、作成と削除が紐付け先の投稿の投稿者本人だけ (`exists` で `posts.author_id = auth.uid()` を確かめる)。

## Alternatives Considered

### Alternative 1: `posts` に URL の配列列を持つ

- **Pros**: テーブルが増えない。
- **Cons**: 縦横・順序を持てず、画像単位の制約や RLS が書けない。保存先を変えると書き換えが必要。
- **Why not**: 画像を行として扱い、キーだけを持たせたい。

### Alternative 2: 完全な URL を持つ

- **Pros**: アプリ側で組み立てる処理が要らない。
- **Cons**: 保存先やドメインの変更で全行の書き換えが必要になる。
- **Why not**: 保存先に依存しない設計にするのが Issue の要件。

## Consequences

### Positive

- 保存先を変えても、アプリ側の URL 組み立てを直すだけで済む。
- 他人の投稿に画像を紐付けられない。

### Negative

- 表示のたびにアプリ側で URL を組み立てる。`get_timeline` などに画像を含めるには別途 join か戻り値の追加が要る。
- 最大 4 枚の上限を CHECK に固定している。変えるにはマイグレーションが要る。

### Risks

- 実際の画像ファイルのアップロードとバケットのポリシーは、この変更の範囲外。`storage_key` が実在するファイルを指すことは DB では保証しない。
- 挙動は `supabase/tests/database/post_media.test.sql` の pgTAP で、CI のローカル Supabase に対して確かめる。

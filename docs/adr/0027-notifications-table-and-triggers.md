# ADR-0027: 通知は notifications テーブルに持ち、いいね・リプライ・フォローのトリガーだけが作る

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-60 で通知を作る。いいね ([ADR-0022](0022-likes-table-and-counter-trigger.md))・リプライ ([ADR-0026](0026-post-detail-and-reply-counter.md))・フォローの発生時に、相手へ通知したい。クライアントが通知を偽造できてはいけない。Data API の自動許可が OFF なので、GRANT・RLS・ポリシーを同じマイグレーションに書く ([ADR-0019](0019-posts-table-and-rls.md))。

## Decision

- `notifications (id, user_id, type, actor_id, post_id, read_at, created_at)` を作る。`type` は `like` / `reply` / `follow` の CHECK。`post_id` は follow のときだけ null (CHECK)。`user_id <> actor_id` の CHECK で自分宛を禁止する。
- `likes`・`posts` (リプライ)・`follows` の insert 後トリガーで通知を作る。自分自身への操作では作らない。リプライの `post_id` は作られたリプライ側の投稿にする。
- トリガー関数は `security definer` にし、`search_path` を空にして execute は誰にも付けない。`authenticated` に insert を付けないため、通知はトリガー経由でしか作れない。
- GRANT は `select` をテーブル全体、`update` を `read_at` 列だけに付ける。Issue の「`select, update` を付与」より狭めた。`type` や `actor_id` を書き換えさせないため。insert・delete は付けない。
- ポリシーは `user_id = auth.uid()` の本人だけ、select と update。
- いいねの取り消し・フォロー解除では通知も消す。付け外しで通知が積み上がるのを防ぐため。リプライの削除は `post_id` の `on delete cascade` で消える。

## Alternatives Considered

### Alternative 1: クライアントから通知を insert させる

- **Pros**: トリガーが要らない。
- **Cons**: 通知を偽造できる。
- **Why not**: 通知はサーバー側の事実だけから作りたい。

### Alternative 2: `update` をテーブル全体に付ける

- **Pros**: Issue の記載どおり。
- **Cons**: 自分宛の通知の中身を書き換えられる。
- **Why not**: 既読化に必要なのは `read_at` だけ。

## Consequences

### Positive

- 他ユーザーの操作で自分宛の通知が作られ、クライアントは偽造も他人の通知の閲覧もできない。

### Negative

- 取り消し時の削除で、通知の履歴は残らない。
- 通知の表示 UI・未読バッジ・リアルタイム配信はまだない。

### Risks

- 挙動は `supabase/tests/database/notifications.test.sql` の pgTAP で確かめる。
- 一括既読の API や、古い通知の削除方針は未定。

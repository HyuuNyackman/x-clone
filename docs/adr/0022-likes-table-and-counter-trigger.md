# ADR-0022: いいねは複合主キーの likes と、トリガーで更新する posts.like_count で持つ

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-56 でいいねを作る。いいね数は一覧のたびに表示するので、毎回 `count(*)` せずにカウンタ列で持ちたい。Data API の自動許可が OFF なので、GRANT・RLS・ポリシーを同じマイグレーションに書く ([ADR-0019](0019-posts-table-and-rls.md))。

## Decision

- `likes (user_id, post_id, created_at)` を作り、`(user_id, post_id)` の複合主キーで二重いいねを防ぐ。どちらも `on delete cascade` にする。`post_id` 単独のインデックスも付ける。
- GRANT は `select, insert, delete` を `authenticated` にだけ付ける。ポリシーは、閲覧が全員、作成と削除が本人 (`auth.uid() = user_id`) だけ。
- `posts.like_count` (`integer not null default 0`、0 以上の CHECK) を足し、`likes` の insert / delete のトリガーで増減する。
- トリガー関数は `security definer` にする。`authenticated` には `posts` の update 権限がなく、付けたくないため。`search_path` を空にし、execute は誰にも付けない。
- `posts` の作成ポリシーに `like_count = 0` を足す。insert の GRANT は列を絞っていないので、作成時にカウンタを偽れてしまうため。

## Alternatives Considered

### Alternative 1: 都度 `count(*)` する

- **Pros**: カウンタのずれが起きない。
- **Cons**: 一覧の取得ごとに集計が走る。
- **Why not**: タイムラインの読み取りを軽くしたい。

### Alternative 2: `posts` に update の GRANT を列単位で付ける

- **Pros**: トリガーを `security invoker` にできる。
- **Cons**: 他人の投稿のカウンタを直接書き換えられてしまう。
- **Why not**: カウンタはトリガーだけが触れるようにしたい。

## Consequences

### Positive

- 二重いいねと他人のいいね操作を DB が拒否する。カウンタは API から直接変えられない。

### Negative

- `posts` に列が増えるので、`get_timeline` などの戻り値には別途 `like_count` を足す必要がある。
- いいねのたびに `posts` の行を更新する。人気の投稿では行ロックの競合が起きうる。

### Risks

- 挙動は `supabase/tests/database/likes.test.sql` の pgTAP で、CI のローカル Supabase に対して確かめる。
- カウンタがずれたときの再集計の手段はまだない。

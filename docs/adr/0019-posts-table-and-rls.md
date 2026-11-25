# ADR-0019: posts は uuid 主キーと本人限定の insert / delete で作り、投稿の種類は列の制約で表す

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-53 で `posts` テーブルを作る。リプライ・引用・リポストも同じテーブルで扱う。Data API の自動許可が OFF なので、GRANT・RLS・ポリシーを同じマイグレーションに書く ([ADR-0011](0011-supabase-migrations-via-cli-and-ci.md)、[ADR-0012](0012-profiles-rls-and-signup-trigger.md))。

## Decision

- 主キーは `uuid` (`gen_random_uuid()`) にする。連番にしないので、シーケンスへの GRANT は要らない。
- `author_id` は `profiles.id` を参照し、ユーザー削除時に連鎖削除する。
- `reply_to` / `quote_of` / `repost_of` は `posts.id` への参照にする。元の投稿が消えたとき、リプライと引用は残して参照を外し (`set null`)、リポストは連鎖削除する。
- 本文は 280 文字までの CHECK を付ける。リポストは本文を空にし、それ以外は空白だけの本文を拒否する。3 つの参照は同時に 2 つ以上指定できない。
- GRANT は `select, insert, delete` を `authenticated` にだけ付ける。編集機能がないので `update` は付けない。`anon` には何も付けない。
- ポリシーは、閲覧が `authenticated` 全員、作成と削除が `auth.uid() = author_id` の本人だけ。
- keyset ページネーション用に `(created_at, id)` のインデックスを作る。

## Alternatives Considered

### Alternative 1: リポストを別テーブルにする

- **Pros**: `posts` の制約が単純になる。
- **Cons**: タイムラインで 2 つのテーブルを混ぜる必要がある。
- **Why not**: 同じ並びで 1 回のクエリで取りたいため。

### Alternative 2: `anon` にも閲覧を許す

- **Pros**: 未ログインでも投稿を読める。
- **Cons**: Issue の完了条件 (未ログインではアクセスできない) に反する。
- **Why not**: Issue の GRANT 指定に従った。

## Consequences

### Positive

- 本人以外は投稿を作れず、消せない。種類の矛盾した行は DB が拒否する。

### Negative

- 元の投稿を消すと、リプライや引用の参照先が失われる (表示側で「削除された投稿」として扱う必要がある)。
- 編集機能を足すときは、`update` の GRANT・ポリシーと ADR の見直しが要る。

### Risks

- 挙動は `supabase/tests/database/posts.test.sql` の pgTAP で、CI のローカル Supabase に対して確かめる。
- 未ログインに読ませたくなったら、`anon` への GRANT とポリシーの追加が要る。

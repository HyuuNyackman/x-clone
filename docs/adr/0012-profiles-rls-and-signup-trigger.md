# ADR-0012: profiles は列単位の GRANT と RLS で守り、サインアップ時にトリガーで自動作成する

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-50 で `profiles` テーブルを作る。Supabase の Data API は、テーブルへの自動許可が OFF である。GRANT が足りないと `permission denied` (42501) になるため、GRANT・RLS・ポリシーをマイグレーションに1セットで書く必要がある ([ADR-0011](0011-supabase-migrations-via-cli-and-ci.md))。
要件は、誰でも閲覧でき、更新は本人だけで、`auth.users` の作成時に行が自動で作られることである。

## Decision

- `profiles.id` は `auth.users.id` を参照する主キーにし、ユーザー削除時に連鎖削除する。
- `handle` は一意制約と、形式チェック `^[a-z0-9_]{3,15}$` を付ける。`display_name` と `bio` にも長さのチェックを付ける。
- GRANT は `select` を `anon` と `authenticated` に、`update` を `authenticated` にだけ付ける。`update` は `handle`・`display_name`・`avatar_url`・`bio` の列に絞り、`id` と `created_at` は変更できなくする。`insert` と `delete` は付けない。
- RLS を有効にする。閲覧のポリシーは全員に許可し、更新のポリシーは `auth.uid() = id` の本人だけに許可する。`auth.uid()` は `(select auth.uid())` で包み、行ごとの再評価を避ける。
- 自動作成は `auth.users` の `after insert` トリガーで行う。関数は `security definer` かつ `search_path = ''` とし、`public` / `anon` / `authenticated` からの実行権限を外す。
- 初期の `handle` は `user_` と uuid の先頭 10 桁にする。`display_name` は、メタデータの `name` があればそれを、なければ `handle` を使う。

## Alternatives Considered

### Alternative 1: アプリ側でサインアップ後に insert する

- **Pros**: トリガーの関数が要らない。
- **Cons**: 通信の失敗やアプリの中断で、`profiles` のないユーザーができる。`insert` の GRANT とポリシーも要る。
- **Why not**: 整合性を DB で保証したいため。

### Alternative 2: `update` をテーブル全体に GRANT する

- **Pros**: 書く量が少ない。
- **Cons**: 本人が `id` や `created_at` を書き換えられる。
- **Why not**: 最小権限にするため、列単位にした。

### Alternative 3: 初期 handle をメールから作る

- **Pros**: 読みやすい handle になる。
- **Cons**: 形式に合わない文字の除去や、重複時の連番処理が要る。メールの一部が公開される。
- **Why not**: uuid 由来なら、衝突も情報漏えいも実質ない。

## Consequences

### Positive

- 他人の行は更新できず、GRANT の範囲も最小になる。
- `profiles` のないユーザーが生まれない。

### Negative

- 初期 handle が読みにくい。ユーザーが変更する画面が別途要る。
- トリガーが失敗すると、サインアップ自体が失敗する。

### Risks

- この SQL の挙動は、XCL-88 の pgTAP (`supabase/tests/database/profiles.test.sql`) で、ローカルの Supabase に対して CI で確かめている。確かめている内容は、サインアップ時の自動作成、他人の行を更新できないこと、`id` と `created_at` を更新できないこと、`insert` と `delete` が拒否されること、GRANT の範囲である (#46)。
- **ホスティング版の「自動許可 OFF」は、ダッシュボードで確認した (2026-11-24、オーナーが「Automatically expose new tables」の OFF を確認)。** ローカルの `supabase/config.toml` も `auto_expose_new_tables = false` にして、同じ前提にそろえている。この設定を入れる前は、ローカルと CI の DB だけ、`anon` / `authenticated` に全権限が自動で付いており、pgTAP が 9 件落ちた。ホスティング版の実際の GRANT は、まだ SQL で確かめていない。設定を変えたときは、この確認をやり直す。
- 未ログインにも全プロフィールを見せる。非公開アカウントを作る場合は、ポリシーの見直しが要る。

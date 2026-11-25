# ADR-0024: 画像は公開バケットを用途別に分け、自分のフォルダだけに書き込ませる

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-63 で画像の保存先を作る。請求先の登録が不要な Supabase Storage を使う (Free プランは保存 1GB、1 ファイル 50MB まで)。サイズ変換は使えないため、縮小はアプリ側で行う (XCL-64)。バケットとポリシーは SQL のマイグレーションで管理する ([ADR-0011](0011-supabase-migrations-via-cli-and-ci.md))。

## Decision

- バケットを 2 つ作る。投稿画像の `post-media` (上限 5MiB) と、アバターの `avatars` (上限 2MiB)。どちらも公開で、許可形式は `image/jpeg`・`image/png`・`image/webp` だけ。
- アバターは別バケットにする。上限サイズと将来の運用 (差し替えの頻度、キャッシュ) が投稿画像と違うため。
- 保存パスは `{ユーザーID}/{ファイル名}`。`storage.objects` の insert ポリシーは、バケットが一致し、直下のフォルダが `auth.uid()` で、階層が 1 つだけのときに許す。delete ポリシーは自分のフォルダだけ。対象は `authenticated` のみで、未ログインは何もできない。
- select と update のポリシーは作らない。公開バケットの URL は認証なしで読め、一覧取得を許さずに済む。update がないので上書き (upsert) もできず、差し替えは削除して作り直す。
- CI のローカル Supabase でも storage を起動する (`start-supabase` から `-x storage` を外した)。マイグレーションと pgTAP は、storage スキーマがあるものとして書き、スキップの分岐は持たない。
- バケットは `insert ... on conflict do update` で作り、マイグレーションを繰り返し流しても設定が揃うようにする。

## Alternatives Considered

### Alternative 1: 1 つのバケットにアバターも入れる

- **Pros**: 管理するバケットが減る。
- **Cons**: 上限サイズや許可形式を用途別に変えられない。
- **Why not**: 用途ごとの設定を分けたい。

### Alternative 2: 非公開バケットと署名付き URL

- **Pros**: 画像を認証済みユーザーだけに見せられる。
- **Cons**: 表示のたびに署名付き URL を作る必要があり、キャッシュも効きにくい。
- **Why not**: 投稿は公開前提で、Issue も読み取り公開を求めている。

## Consequences

### Positive

- 他人のフォルダへの書き込みと未ログインのアップロードを、RLS で拒否できる。
- サイズと形式の制限は Storage 側で効き、アプリを迂回されても守られる。

### Negative

- ファイルを消しても、`post_media` の行は自動では消えない (逆も同じ)。アプリ側で両方を消す必要がある。
- `storage_key` ([ADR-0023](0023-post-media-table-and-storage-key.md)) の例は `posts/<post_id>/0.jpg` だが、Storage のパスは `{ユーザーID}/{ファイル名}` になる。実際のキーはこの形式に合わせる。

### Risks

- ファイルサイズと形式の拒否は Storage API の層で行われ、pgTAP では設定値しか確かめられない。実際の拒否は E2E などで別途確かめる必要がある。
- 1GB を超えるとアップロードが失敗する。使用量は Supabase のダッシュボードで確認する。

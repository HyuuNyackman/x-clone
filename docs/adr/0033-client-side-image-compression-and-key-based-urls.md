# ADR-0033: 画像は端末側で縮小・圧縮してアップロードし、表示 URL はキーから組み立てる

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-64 で画像付き投稿とアバターを作る。Supabase Free では Storage の画像変換が使えない。保存先 (Supabase Storage から R2 など) は将来変えうる。

## Decision

- 選択は `expo-image-picker`、縮小・圧縮は `expo-image-manipulator` で、アップロード前に端末側で行う。長辺 1280px 以下の JPEG にし、1 枚 200KB を目安に品質を 0.8 → 0.35 の順に下げる。
- アップロードはクライアントから Storage へ直接行う。パスは RLS に合わせて `{ユーザーID}/{UUID}.jpg`。投稿画像は `post-media`、アバターは `avatars` バケット。
- DB (`post_media.storage_key`、`profiles.avatar_url`) にはキーだけを保存する。表示 URL は `mediaUrl()` が組み立てる。`EXPO_PUBLIC_MEDIA_BASE_URL` で保存先を切り替えられる。
- 表示は `expo-image` のディスクキャッシュを使う。
- 投稿は、画像のアップロード → posts の insert → post_media の insert の順に行う。途中で失敗したら、作った投稿とアップロード済みの画像を消す。
- タイムライン (RPC) の結果には画像を含めず、`post_media` を 1 回の追加クエリでまとめて読む。RPC は変えない。

## Alternatives Considered

### Alternative 1: サーバー (Edge Function) で縮小する

- **Pros**: 端末ごとの差が出ない。
- **Cons**: 実行時間と転送量を使う。Free 枠で扱いにくい。
- **Why not**: 端末側で十分に縮小できる。

### Alternative 2: DB に公開 URL を保存する

- **Pros**: 表示側の組み立てが要らない。
- **Cons**: 保存先やドメインを変えると、全行の更新が要る。
- **Why not**: 保存先を変えやすくする方針に反する。

## Consequences

### Positive

- アップロード量と保存量が小さく抑えられる。保存先の変更が環境変数と移行作業で済む。

### Negative

- タイムライン 1 ページの取得でクエリが 1 本増える。
- 失敗時の後始末は best effort で、失敗すると孤児ファイルが残る。

### Risks

- 作業環境ではネイティブ・Safari/PWA の実機確認、`supabase test db`、Playwright の実行ができていない (CI と実機で確かめる)。
- 画像が目安 (200KB) に収まらないときは最低品質の結果をそのままアップロードする。上限は Storage 側の 5MiB (投稿) / 2MiB (アバター)。
- 投稿カードにはアバターを出していない。`get_timeline` に avatar_url を足す必要がある。

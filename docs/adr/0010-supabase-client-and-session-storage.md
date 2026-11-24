# ADR-0010: Supabase クライアントはアプリ内で anon キーだけを使い、セッションは AsyncStorage に保存する

**Date**: 2026-11-23
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-49 でアプリから Supabase に接続する。アプリは Expo Go と Web の両方で動かす。
`EXPO_PUBLIC_` の環境変数はバンドルに埋め込まれ、誰でも読める。ログインのセッション (トークン) は、アプリを閉じても残す必要がある。

## Decision

`@supabase/supabase-js` で `src/lib/supabase.ts` にクライアントを 1 つ作る。接続情報は `EXPO_PUBLIC_SUPABASE_URL` と `EXPO_PUBLIC_SUPABASE_ANON_KEY` で渡し、雛形を `.env.example` に置く。
アプリに入れるキーは anon キーだけにし、データの保護は RLS で行う。セッションの保存先は `@react-native-async-storage/async-storage` にする。

## Alternatives Considered

### Alternative 1: expo-secure-store

- **Pros**: 保存時に暗号化される。
- **Cons**: 1 値あたり約 2KB の上限があり、Supabase のセッションは超えうる。Web では使えない。
- **Why not**: 上限と Web 非対応のため、そのままでは使えない。暗号化して分割保存する方法もあるが、今は複雑さに見合わない。

### Alternative 2: expo-sqlite の localStorage

- **Pros**: Expo の公式ガイドが使う方法。同期的に読める。
- **Cons**: config plugin の追加が必要で、Expo Go での動作を確認できていない。
- **Why not**: AsyncStorage は Expo Go に同梱され、Web でも動くため、先にこちらを選ぶ。

## Consequences

### Positive

- Expo Go と Web の両方で、追加のネイティブ設定なしに動く。
- アプリに秘密を持たせない方針が、コードと `.env.example` に明記される。

### Negative

- AsyncStorage は暗号化されない。端末が侵害されると、セッションのトークンを読まれる。
- 接続確認は、テーブルがまだないため、存在しないテーブルへのクエリで代用している。

### Risks

- 環境変数は `EXPO_PUBLIC_` のため、ビルド時に埋め込まれる。`.env` はローカル専用なので、CI のビルドには GitHub の Variables (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`) を `_cloudflare-deploy.yml` の `build:web` で渡す。Variables を登録しないと、Preview と本番は起動時にエラーになる。
- Preview と本番で同じ Supabase プロジェクトを使う。分ける場合は GitHub Environments を使う (XCL-76 で判断)。
- 実際の Supabase への接続は、このPRでは確認できていない。Expo Go と Web での確認が必要。

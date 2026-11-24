# ADR-0014: 認証はメール + パスワードにし、セッションを Zustand で持って Stack.Protected でガードする

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-51 で、サインアップ・ログイン・ログアウトと、未ログイン時のルートガードを作る。Expo Go と Web の両方で動かす必要がある。
Expo Go ではソーシャルログインのリダイレクトが扱いにくいため、今回は対象にしない。

## Decision

- 認証方式はメール + パスワード (`supabase.auth.signUp` / `signInWithPassword` / `signOut`) にする。
- セッションは `src/features/auth/auth-store.ts` の Zustand ストアで持つ。起動時に `getSession()` で保存済みセッションを読み、`onAuthStateChange` で更新する。読み込みが終わるまでは `initialized=false` とし、画面を出さない。
- ルートガードは Expo Router の `Stack.Protected` を使う。ログイン済みは `(tabs)`、未ログインは `(auth)` だけに入れる。ログイン・ログアウト後の遷移はガードが自動で行い、画面側では `router.replace` を呼ばない。
- フォームは React Hook Form + Zod (`@hookform/resolvers`) で検証する。

## Alternatives Considered

### Alternative 1: 画面ごとに `useEffect` で `router.replace` する

- **Pros**: 追加の仕組みが要らない。
- **Cons**: 画面が一瞬見える、戻るボタンで保護画面に戻れる、といった漏れが起きやすい。
- **Why not**: `Stack.Protected` は宣言だけで、履歴からも該当画面を外せる。

### Alternative 2: React Context でセッションを持つ

- **Pros**: 依存が増えない。
- **Cons**: ADR-0007 でクライアント状態は Zustand と決めており、方針が割れる。
- **Why not**: 既存方針に合わせる。

## Consequences

### Positive

- ガードが `_layout.tsx` の1か所に集まる。セッションは AsyncStorage に保存されており (ADR-0010)、再起動後も保持される。

### Negative

- メール確認が有効なプロジェクトでは、登録直後にセッションが入らない。画面で確認待ちを案内するだけで、確認メールの再送は未実装。

### Risks

- Expo Go と Web での実機確認は、このPRでは行えていない (型・lint・Web ビルドのみ確認)。
- パスワードの複雑さの規則は、Supabase 側の設定と Zod 側 (8文字以上) で別々に持つ。ずれると登録時に `weak_password` エラーになる。
- パスワード再設定・メール確認の再送・ソーシャルログインは未対応。
- 誰でもサインアップできる。publishable キーは公開前提のため、画面を隠しても API から登録される。承認制は [XCL-81](https://linear.app/hyuunyackman/issue/XCL-81) で扱う。それまでは公開 URL を広めない。

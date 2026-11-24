# ADR-0020: 投稿作成はモーダル画面にし、タイムラインは TanStack Query の楽観的更新で反映する

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-54 で投稿の作成と削除を作る。作成 UI の置き場所と、投稿後にタイムラインへ反映する方法を決める必要がある。状態管理は [ADR-0007](0007-state-management-tanstack-query-and-zustand.md) でサーバー状態を TanStack Query に置くと決めている。

## Decision

- 作成 UI は `src/app/compose.tsx` のモーダル画面にする (ルートの `Stack` で `presentation: 'modal'`)。ホームの「投稿する」ボタンから開く。Expo Go と Web のどちらでも、同じルートで動く。
- 文字数カウンタは残り文字数を出し、280 文字を超えると赤くして投稿ボタンを無効にする。上限は `POST_MAX_LENGTH` で、DB の CHECK と揃える。
- タイムラインは `['posts', 'timeline']` のクエリで持つ。投稿・削除は `onMutate` でキャッシュを先に書き換え、失敗したら元に戻し、完了後に再取得する。
- 削除ボタンは自分の投稿にだけ出す。実際の権限は RLS (ADR-0019) が守る。
- タイムラインは新しい順の先頭 50 件だけ読む。ページネーションは別の Issue で行う。

## Alternatives Considered

### Alternative 1: ホームに入力欄を埋め込む

- **Pros**: 画面遷移がない。
- **Cons**: ホームが重くなり、あとからリプライや引用の入力に流用しにくい。
- **Why not**: 別画面にすれば、リプライや引用でも同じ画面を使い回せる。

### Alternative 2: 楽観的更新をせず、保存後に再取得する

- **Pros**: 実装が単純。
- **Cons**: 反映が通信待ちになる。
- **Why not**: Issue で楽観的更新を求められている。

## Consequences

### Positive

- 投稿・削除がすぐ画面に出る。失敗時は元に戻り、エラーを表示する。

### Negative

- 仮の投稿は `optimistic-` で始まる一時 id を持つ。その間は削除できない。
- 先頭 50 件より古い投稿は、ページネーションができるまで見られない。

### Risks

- 挙動は Jest (`posts-api.test.ts`、`compose-screen.test.tsx`) と Playwright (`e2e/posts.spec.ts`) で確かめる。Expo Go の実機での確認は、まだ人が行っていない。

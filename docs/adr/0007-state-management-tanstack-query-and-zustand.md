# ADR-0007: サーバー状態は TanStack Query、クライアント状態は Zustand で持つ

**Date**: 2026-11-23
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-47 で状態管理のライブラリを決める。タイムライン・プロフィール・通知などサーバー由来のデータが大半を占め、キャッシュ・再取得・ページングが必要になる。
それとは別に、テーマ設定や投稿の下書きなど、端末内だけで完結する UI の状態がある。Issue には「Zustand は本当に適切か選定する」と書かれている。

## Decision

サーバー由来のデータは TanStack Query (`@tanstack/react-query` v5) で扱い、端末内だけの状態は Zustand (v5) で扱う。
Zustand は機能ごとに小さなストアを作る (例: `src/features/theme/theme-store.ts`)。サーバーのデータを Zustand に複製しない。

## Alternatives Considered

### Alternative 1: Jotai

- **Pros**: アトム単位で再描画を絞れる。Provider なしでも使える。
- **Cons**: 状態が多数のアトムに分かれ、ストアの全体像が追いにくい。
- **Why not**: 想定するクライアント状態は少なく、機能ごとにまとまるストアの方が読みやすい。差は小さく、決定的な理由ではない。

### Alternative 2: React Context + `useReducer`

- **Pros**: 追加の依存がない。
- **Cons**: 値が変わると購読している全コンポーネントが再描画される。React の外 (認証イベントのコールバックなど) から更新しにくい。
- **Why not**: 再描画の制御と React 外からの更新で、結局ストアを自作することになる。

### Alternative 3: Redux Toolkit

- **Pros**: 実績が多く、開発者ツールが充実している。
- **Cons**: 設定とボイラープレートが多い。RTK Query を使うと TanStack Query と役割が重なる。
- **Why not**: この規模では過剰。

### Alternative 4: TanStack Query のみ (クライアント状態用のライブラリなし)

- **Pros**: 依存が最小。
- **Cons**: テーマ設定のような端末内の状態の置き場がなく、結局 Context を使うことになる。
- **Why not**: クライアント状態が確実に存在するため。ただし数が増えなければ、Zustand の出番は小さいままでよい。

## Consequences

### Positive

- 役割が分かれる。サーバーのデータは Query、端末内の状態は Zustand。
- Zustand は Provider が不要で、セレクタで再描画を絞れる。React 外からも `getState()` で読み書きできる。
- 永続化が必要になったら、`persist` ミドルウェアと AsyncStorage で足せる。

### Negative

- 状態管理の依存が 2 つになる。
- 永続化 (テーマ設定の保存) はまだ入れていない。設定画面の実装時に追加する。

### Risks

- Zustand に API のデータを入れ始めると、Query とキャッシュが二重になる。レビューで気を付ける。

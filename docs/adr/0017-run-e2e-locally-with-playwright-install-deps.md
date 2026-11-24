# ADR-0017: E2E のローカル実行は、依存ライブラリを入れて Playwright をそのまま動かす

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

E2E は CI で動くが ([ADR-0015](0015-production-deploy-only-from-main.md))、WSL のローカルでは、Chromium が共有ライブラリ (`libnspr4` など) を見つけられず、起動に失敗する。ローカルでの実行手順が、どこにも書かれていなかった。

## Decision

- ローカルでは、`sudo pnpm exec playwright install-deps chromium` で依存ライブラリを入れ、`pnpm e2e` をそのまま動かす。
- 手順 (Supabase の起動、環境変数、ビルド、実行、レポートの見方) は README に書く。

## Alternatives Considered

### Alternative 1: 公式の Playwright の Docker イメージで実行する

- **Pros**: ホストを汚さない。ブラウザの環境が CI と揃う。
- **Cons**: コンテナからホストの Supabase に繋ぐためのネットワーク設定が要る。接続先のガード (ローカルのみ) とも噛み合わせが要る。
- **Why not**: 手順が増える。依存ライブラリの導入は 1 回で済む。

## Consequences

### Positive

- CI と同じコマンドで、手元でも実行できる。

### Negative

- 初回に sudo が要る。

### Risks

- Playwright の版を上げると、必要なライブラリが変わることがある。起動に失敗したら、`install-deps` をもう一度実行する。
- この手順は、実機で通して確かめていない (CI の環境には Docker と sudo が無い)。手順の誤りに気づいたら、README を直す。

# ADR-0002: lint・format・typecheck を CI で検査する

**Date**: 2026-11-23
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

コードの品質を、人の注意ではなく仕組みで保ちたい。Claude が実装する場合も、同じ基準で検査したい。

## Decision

- **lint**: ESLint 9 (flat config) に `eslint-config-expo` を使い、`eslint-config-prettier` で整形と衝突するルールを切る。
- **format**: Prettier。`singleQuote`、`semi`、`trailingComma: all`、`printWidth: 100`。
- **typecheck**: `tsc --noEmit`。
- `package.json` に `lint` / `typecheck` / `format` / `format:check` を置く。
- GitHub Actions の `CI` を、`main` と `develop` への push と、すべての PR で実行する。順に lint、typecheck、format:check を走らせる。
- pnpm のバージョンは `package.json` の `packageManager` で固定し、`pnpm/action-setup` はそれを読む。Node は `.node-version` から読む。

## Alternatives Considered

### Alternative 1: ローカルの pre-commit フックだけで検査する

- **Pros**: 手元で早く気づける。
- **Cons**: フックを迂回でき、Claude の CI 実行では効かない。
- **Why not**: PR で必ず検査する仕組みが必要。

## Consequences

### Positive

- PR を作ると CI が走り、3つの検査の結果が分かる。

### Negative

- 検査をマージの必須条件にするかは、リポジトリ設定で別に決める必要がある。
- `.github/workflows/` は Claude の GitHub App に変更権限がないため、`ci.yml` は人が追加する。

### Risks

- `apm_modules/`、`dist/`、`.expo/` は検査の対象外にしている。対象外を増やすときは、理由を確認する。

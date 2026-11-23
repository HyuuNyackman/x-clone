# ADR-0006: スタイリングは NativeWind v4 (Tailwind CSS 3) を使い、コードは `src/` 配下に置く

**Date**: 2026-11-23
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-47 で Tailwind のクラスで UI を書けるようにする。Expo Go と Web の両方で同じクラスが効く必要がある。
NativeWind には安定版の v4 (Tailwind CSS 3) と、プレリリースの v5 (Tailwind CSS 4、`react-native-css`) がある。
v5 の公式ドキュメントは「本番利用を意図しない」と明記しており、検証済みの環境は Expo 57 / React Native 0.86 で、このプロジェクトの Expo 58 / React Native 0.88 とは異なる。

## Decision

NativeWind は安定版の `4.2.7`(`tailwindcss` は 3.4 系)を使う。v5 が正式版になった時点で移行を再検討する。
ルートは Expo Router の `src/app/` に置き、それ以外を `src/components/`、`src/features/<機能>/`、`src/lib/`、`src/theme/` に分ける。`@/*` を `src/*` に割り当てる。
色は `src/theme/tokens.ts` の CSS 変数 (ライト/ダーク) を `tailwind.config.js` から参照する。

## Alternatives Considered

### Alternative 1: NativeWind v5 (プレリリース)

- **Pros**: Tailwind CSS 4 を使える。新しい仕組みに最初から乗れる。
- **Cons**: 公式が本番利用を想定していない。このプロジェクトの Expo / React Native のバージョンで検証されていない。
- **Why not**: 安定版があるため、わざわざ不安定な方を選ぶ理由がない。

### Alternative 2: `StyleSheet` のみ (Tailwind なし)

- **Pros**: 追加の依存がない。
- **Cons**: ダークテーマや余白・色の統一を自前で組む必要がある。
- **Why not**: Issue の要件が Tailwind の導入であるため。

## Consequences

### Positive

- Expo Go と Web で同じクラスが使える。Web のビルドで `bg-background` などのクラスが CSS に出力されることを確認した。
- 色の定義が 1 か所にあり、ライト/ダークの切り替えがクラス側の変更なしでできる。

### Negative

- pnpm の厳密な依存解決のため、`nativewind` の内部依存 `react-native-css-interop` を直接の依存に加えている (`nativewind` と同じ 0.2.7)。
- `nativewind` を上げるときは `react-native-css-interop` も合わせて上げる必要がある。

### Risks

- v4 は Expo 58 / React Native 0.88 の組み合わせを公式に明記していない。Web のビルドは通ったが、Expo Go での見た目は実機で確認が必要。
- v5 への移行時は Babel / Metro / CSS の設定を作り直す。

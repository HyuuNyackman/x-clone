This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
pnpm test                   # unit tests (jest-expo + React Native Testing Library)
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint, typecheck, and `pnpm test` before declaring any task done.

Unit tests live next to the code as `*.test.ts(x)` (screens in `src/__tests__/`). Never put test files under `src/app/` — every file there becomes a route. Mock `@/lib/supabase` or `@/features/auth/auth-api` so tests never reach a real Supabase. E2E tests (Playwright) live in `e2e/` and run only in CI against a local Supabase.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Supabase のテスト

- テーブル・ポリシー・トリガーを追加・変更するときは、`supabase/tests/database/` に pgTAP のテストを一緒に書く。確かめる内容は、構造、GRANT、RLS (本人・他人・未ログイン)、トリガー。例は `profiles.test.sql`。
- 実行は `supabase test db`。CI は `supabase/` に変更があると、ローカルの Supabase (native runtime) で自動的に実行する。
- `supabase/config.toml` の `auto_expose_new_tables = false` を変えない。ホスティング版と同じく、GRANT を明示しないテーブルを API から使えないようにするため。

## 技術負債の扱い

作業中に見つけた、今回は直さない将来の技術負債(未検証の項目、先送りした判断、暫定対応、既知のリスク)は、黙って残さず Linear に Issue として切る。

- 作る前に `list_issues` で重複を確認する。既にあれば新規作成せず、そちらにコメントや関連付けを足す。
- チームは `XCL`、プロジェクトは `X Clone`、状態は `Backlog`。ラベルは内容に合うものを付ける (`infra` / `backend` / `frontend` / `db` / `docs` など)。
- 人間の判断や作業が要るもの (方針の決定、設定の変更、権限や安全性に関わる判断など) には `needs-human` ラベルも付ける。自動の着手の対象から外れる。CI の Claude が GitHub Issue を作るときも同じで、`gh issue create --label needs-human` で付ける。
- 今の作業の Issue に `relatedTo` で関連付ける。関連する既存 Issue (例: Supabase なら XCL-48) があれば、それも付ける。
- 1件に1つの論点を書く。何が負債か、なぜ今やらないか、やること、期限の目安を、人が読める短い文で書く。実装メモは `+++ Agent notes` の折りたたみに入れる。
- 設計判断を伴うものは ADR (`docs/adr/`) の Risks / Negative にも書き、Issue から参照する。
- 作業の最後の報告に、作った Issue の ID と一行の要約を載せる。
- 実装の途中で直せる小さなものは、Issue にせず今の PR で直す。
- CI (GitHub Actions) の Claude は Linear を操作できないので、GitHub Issue として作る。Linear とは双方向に同期される。手順は `.github/workflows/claude.yml` の `--append-system-prompt` に書いてあり、経緯は [ADR-0009](docs/adr/0009-claude-actions-file-tech-debt-as-github-issues.md) にある。

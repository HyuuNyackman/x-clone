# ADR-0015: 本番への反映は main への push だけで行い、develop は統合の場にする

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

いまは `develop` への push で、Cloudflare の本番デプロイと `supabase db push` が動く ([ADR-0005](0005-cloudflare-deploy-method.md)、[ADR-0008](0008-pr-preview-and-reusable-workflows.md)、[ADR-0011](0011-supabase-migrations-via-cli-and-ci.md))。
Linear の Issue から実装、テスト、マージまでを自動で進める仕組みを入れると、`develop` へのマージが人の確認なしに増える。そのたびに本番へ出るのは危険である。
人の確認は、`develop` から `main` へ持っていく 1 回に集めたい。

## Decision

- 本番への反映 (Cloudflare のデプロイと `supabase db push`) は、`main` への push だけで行う。`develop` への push では、本番に触れない。
- `develop` は、確認済みの変更が溜まる統合ブランチにする。人は `develop → main` の PR で、全体を確認する。
- Preview と `supabase db push --dry-run` は、`develop` 向けと `main` 向けの両方の PR で動かす。
- staging 環境は作らない。統合後の状態は、`develop → main` の PR の Preview で確認する。
- Preview は、本番の Supabase に繋ぐ。人が触るときは、確認用のアカウントだけを使う。作ったデータは、確認用だと分かる名前にして、後で手動で消す。
- マージ前の自動テスト (E2E、pgTAP) は、ローカルの Supabase だけに繋ぎ、本番には触れない (計測結果は XCL-85、実装は XCL-87 と XCL-88 を参照)。

## Alternatives Considered

### Alternative 1: `develop` への push で本番に反映したままにする

- **Pros**: 変更がすぐ本番に出る。今のワークフローを変えなくてよい。
- **Cons**: 自動マージを入れると、人が確認しないまま本番が変わる。
- **Why not**: 人の確認を 1 回に集める目的に合わない。

### Alternative 2: staging 環境 (Cloudflare の別 Worker と別の Supabase プロジェクト) を作る

- **Pros**: 本番のデータに触れずに、統合後の状態を確認できる。
- **Cons**: Supabase のプロジェクトとマイグレーションの運用が、2 つに増える。
- **Why not**: いまの規模では、運用の負担が見合わない。統合後の確認で困ったときに足す。

### Alternative 3: Supabase の preview ブランチ機能を使う

- **Pros**: PR ごとに、独立したデータベースで確認できる。
- **Cons**: 有料プランが必要になる。
- **Why not**: 同じ目的を、ローカルへの全マイグレーション適用 (E2E と pgTAP) と、`main` 向け PR の dry-run で代替できる。

## Consequences

### Positive

- 人の確認が `develop → main` の 1 回に集まり、`develop` への自動マージが安全になる。
- 本番の Supabase に触れるのは、`main` への push と、人が確認用アカウントで触るときだけになる。

### Negative

- `develop` の変更は、`main` に持っていくまで本番に出ない。
- 1 回の確認で見る差分が大きくなりやすい。リリースの頻度を決めて、差分を小さく保つ必要がある。

### Risks

- **マイグレーションが `main` で初めて本番に当たる。** ローカルでの全適用 (E2E と pgTAP) と dry-run で、構文の誤りや履歴のずれは検出できる。本番のデータに依存する失敗 (既存の行が新しい制約に違反する、など) や、ロックの影響は、`main` へのマージ時に初めて起きる。破壊的な SQL の警告と、適用前のバックアップは、リリース PR の自動要約 (XCL-94) で扱う。
- **Preview から本番のデータを触れる。** 確認中のバグが、本番のデータを壊すおそれがある。確認は確認用のアカウントだけで行う。RLS を変更した PR の確認では、特に注意する。
- **Preview の URL は公開されている。** 本番に繋がった画面を、第三者が開ける。サインアップが誰でもできる設定 ([ADR-0014](0014-auth-session-store-and-route-guard.md)) と重なる。アクセス制限は XCL-73 で判断する。
- **ホスティング版の Data API の自動許可は、OFF であることを確認した** (2026-11-24、[ADR-0012](0012-profiles-rls-and-signup-trigger.md))。マイグレーションの GRANT は、OFF を前提に書いてある。この設定が ON に戻ると、本番の権限が前提より広くなる。
- **`main` への直接の push を防ぐには、ブランチ保護が要る。** 設定は XCL-93 で行う。それまでは、運用で守る。

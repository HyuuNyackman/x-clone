# ADR-0011: Supabase のスキーマ変更はマイグレーションファイルで管理し、develop へのマージで CI が自動適用する

**Date**: 2026-11-24
**Status**: accepted (`db push` の起動条件は [ADR-0015](0015-production-deploy-only-from-main.md) で `main` への push に変更)
**Deciders**: HyuuNyackman

## Context

XCL-48 で Supabase のスキーマ管理を始める。ダッシュボードで直接テーブルを変えると、変更の履歴がリポジトリに残らず、レビューもできない。
個人開発で、実装の多くを AI に任せる方針である。ただし認証情報 (アクセストークン、DB パスワード) は、AI や会話に渡さない。
Supabase のプロジェクトは 1 つで、Preview と `develop` が同じ DB を使う ([ADR-0010](0010-supabase-client-and-session-storage.md))。
このリポジトリは `develop` に統合し、`main` はリリース用に使う。自動適用のタイミングは `develop` へのマージにしたい。

## Decision

スキーマの変更は、`supabase migration new` で作った SQL を `supabase/migrations/` に置いて行い、リポジトリで管理する。ダッシュボードでの直接変更はしない。
反映は GitHub Actions が行う。入口の `ci.yml` から `_supabase-migrate.yml` を呼び、`develop` 向けの PR では `supabase db push --remote --dry-run` で検証し、`develop` への push では `supabase db push --remote --yes` で適用する。
反映を CI (GitHub Actions) で行う理由は 3 つある。

- 手動だと、`db push` の実行を忘れて、アプリのコードと DB の状態がずれる。PR をマージすれば反映される流れにして、人が覚えておく手順を減らす。
- Supabase 標準の GitHub 連携は、無料プランでは production ブランチを変えられず、`develop` へのマージで反映できない。Actions なら、反映するブランチを自分で決められる。
- 検証 (`dry-run`) と適用を、既存の `ci.yml` に並べられる。lint などの検査に成功したあとにだけ流れるので、既存の CI と同じ流れで読める。

認証情報 (`SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD`、`SUPABASE_PROJECT_REF`) は GitHub Secrets にだけ置く。CLI のバージョンは、手元と CI で揃えて固定する。
手元の CLI は WSL に入れる。マイグレーションの SQL は、人間がレビューしてからマージする。

## Alternatives Considered

### Alternative 1: 手動で `supabase db push` する

- **Pros**: Secrets の設定が要らない。誤って本番に流れる心配が少ない。
- **Cons**: 実行を忘れると、アプリのコードと DB の状態がずれる。
- **Why not**: AI が PR を出し、マージで反映される流れにしたいため。

### Alternative 2: Supabase の GitHub 連携で自動デプロイする

- **Pros**: Actions も、アクセストークンや DB パスワードの Secrets も要らない。公式ドキュメントでは、どのプランでも使えるとされている。
- **Cons**: production ブランチを `develop` に変えられない (無料プランで確認)。反映できるのは `main` への push だけになる。PR での検証は、Branching の機能が前提になると読める (未確認)。
- **Why not**: `develop` へのマージで反映したいという方針に合わないため。

### Alternative 3: Supabase Branching (PR ごとの DB ブランチ)

- **Pros**: PR ごとに独立した DB を持てる。
- **Cons**: 有料プランが要る (未確認)。個人開発には過剰である。
- **Why not**: 今はデータがほぼなく、Preview と DB を共有しても困らないため。

### Alternative 4: CLI を devDependency に入れ、`pnpm supabase` で実行する

- **Pros**: CI とバージョンを揃えやすい。WSL への導入が要らない。
- **Cons**: `supabase link` などはどのみち手元で一度実行する。
- **Why not**: WSL にグローバルに入れるほうが、手順が単純なため。バージョンは CI 側で固定して揃える。

## Consequences

### Positive

- スキーマの変更履歴がリポジトリに残り、PR でレビューできる。
- 認証情報がリポジトリや会話に出ない。
- PR の段階で、マイグレーションが通るかを確認できる。

### Negative

- `develop` にマージした時点で、本番相当の DB に反映される。戻すには、新しいマイグレーションを足す必要がある。
- `dry-run` は、SQL が実際に成功するかまでは保証しない。

### Risks

- AI が書いた SQL に `DROP` や RLS の付け忘れがあっても、そのまま反映される。マージ前に人間が SQL を確認する。
- Preview と `develop` が同じ DB を使う。実ユーザーを入れる前に、`dev` と `prod` の 2 プロジェクトに分けることを検討する (XCL-76)。
- 手元と CI の CLI のバージョンがずれると、挙動が変わりうる。`_supabase-migrate.yml` の `SUPABASE_CLI_VERSION` を、手元の `supabase --version` と一緒に更新する。

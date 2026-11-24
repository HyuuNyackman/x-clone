# ADR-0008: develop 向けの PR を Cloudflare Workers Previews で公開し、CI を入口の1ファイルと再利用ワークフローに分ける

**Date**: 2026-11-23
**Status**: accepted (本番デプロイの起動条件と Preview の対象ブランチは [ADR-0015](0015-production-deploy-only-from-main.md) で変更)
**Deciders**: HyuuNyackman

## Context

[ADR-0005](0005-cloudflare-deploy-method.md) では `develop` への push だけをデプロイし、PR ごとのプレビューは持たなかった。
PR の段階で iPhone の Safari から動作を確認したいので、PR ごとの公開 URL が必要になった。
ADR-0005 は、Preview URL が必要になった時点で Workers Builds (Git 連携) を再検討するとしていた。
あわせて、検査 (`ci.yml`) とデプロイ (`deploy.yml`) が別ファイルで、検査に失敗してもデプロイが走る状態だった。
今後 Supabase など連携先が増える予定もある。

## Decision

`develop` 向けの PR では、Workers Previews (`wrangler preview --name pr-<PR 番号>`) で公開し、URL を PR にコメントする。PR を閉じたら Preview を削除する。

入口は `.github/workflows/ci.yml` の1つにし、トリガーと呼び出す順序だけを書く。中身は再利用ワークフローに分ける。

- `_check.yml`: lint・typecheck・format
- `_cloudflare-deploy.yml`: Cloudflare への公開と撤去。PR の Preview 公開、PR を閉じたときの Preview 削除、`develop` への本番デプロイの3つのジョブを持ち、呼び出し元のイベントでどれが動くかを決める

Preview とデプロイは、検査の成功後にだけ実行する。PR を閉じたときは検査が skip されるので、入口では `!cancelled() && !failure()` で呼び出し、検査が失敗したときだけ止める。
再利用ワークフローはサブディレクトリに置けないため、先頭の `_` で入口と区別し、連携先ごとの接頭辞 (`cloudflare-`) を付ける。今後 Supabase などが増えたら、同じ規則で `_supabase-*.yml` を足す。
共通のセットアップ (pnpm・Node.js・依存関係) は composite action `.github/actions/setup` に置く。

## Alternatives Considered

### Alternative 1: Cloudflare Workers Builds (Git 連携)

- **Pros**: Secrets を GitHub に置かなくてよい。Preview URL と PR コメントが標準で付く。
- **Cons**: ビルド設定がダッシュボードにあり、リポジトリで管理できない。CI の検査と別系統で、検査の成功を条件にできない。
- **Why not**: ADR-0005 と同じく、設定をリポジトリに残し、検査と同じ流れで制御したいため。

### Alternative 2: トリガーごとに独立したワークフローを置く (`ci.yml`・`deploy.yml`・`preview.yml`)

- **Pros**: ファイルごとに役割が分かれ、トリガーも単純になる。
- **Cons**: 検査の成功を条件にするには `workflow_run` などが必要で複雑になる。全体の流れが見えにくい。
- **Why not**: 入口から `needs` で呼び出せば、検査の成功を条件にしつつ、全体の流れを1か所で読めるため。

### Alternative 3: すべてのジョブを `ci.yml` に書く

- **Pros**: ファイルが1つで、追う場所が少ない。
- **Cons**: 連携先が増えると、1ファイルが長くなる。
- **Why not**: Supabase など連携先が増える予定があり、連携先ごとに分けておくほうが変更しやすいため。

## Consequences

### Positive

- PR ごとに公開 URL ができ、マージ前に実機で確認できる。
- 検査が失敗した変更は、Preview にもデプロイにも出ない。
- `ci.yml` を読めば全体の流れが分かり、連携先が増えても `_<連携先>-*.yml` と数行の追加で済む。
- セットアップ手順が composite action に集約され、重複しない。

### Negative

- ファイルが増え、入口から `_*.yml` への対応を追う手間が出る。
- `_cloudflare-deploy.yml` を呼ぶたびにワークフローの実行が作られ、イベントによっては全ジョブが skip される (例: `main` への push)。
- 検査の待ち時間の分、Preview の公開が遅れる。

### Risks

- Preview の URL は公開されており、誰でも開ける。非公開にしたい内容を載せる前に Cloudflare Access などで保護する。
- fork からの PR は Secrets が渡らないため Preview が作られない。意図した動作で、リポジトリ内のブランチからの PR だけを対象にしている。
- `wrangler preview` は open beta で、4.135.0 以上が必要。仕様が変わったら `_cloudflare-preview.yml` を見直す。
- 閉じ忘れや削除の失敗で Preview が残る可能性がある。自動の期限切れは確認できていない。
- `paths:` はワークフロー全体のトリガーにしか効かず、再利用ワークフローには使えない。変更箇所での絞り込みが必要になったら、入口に変更検知のジョブを足す。

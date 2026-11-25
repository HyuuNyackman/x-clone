# ADR-0030: CI とレビューの失敗は、workflow_run で別のジョブが起動して直す

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

[ADR-0016](0016-automated-pipeline-from-linear-to-merge.md) では、Claude が PR を作った後、同じ実行の中で CI の完了を待ち、失敗したら直すことにした。
しかし XCL-59 (PR #117) では、Claude の実行が PR の作成の約 8 秒後に正常終了し、待機の手順は実行されなかった。CI の e2e はその約 2 分後に失敗し、誰も気づかなかった。
指示の遵守に頼る仕組みでは、守られなかったときに検知する手段がない。長い待機は、実行時間と利用枠も使う。
既定ブランチは `develop` で、`workflow_run` は既定ブランチのワークフローで動く。

## Decision

CI の失敗を直す処理を、`claude-fix.yml` に分ける。`CI` または `Claude Code Review` が失敗で終わったとき (`workflow_run`)、Claude を起動して直させる。
`claude.yml` は PR を作った時点で終わり、CI を待たない。

- **対象**: `claude/` で始まる、同じリポジトリのブランチの PR だけ。fork は除く。
- **上限**: ブランチの `[<key>] fix:` のコミットが 3 件になったら、Issue にコメントして止める。回数はワークフローが数え、Claude の自己申告には頼らない。
- **競合の防止**: ブランチごとの `concurrency` で 1 本ずつ動かす。ブランチの先頭が失敗したコミットと違うときは、古い失敗なので何もしない。
- **レビューの指摘**: `Claude Code Review` は、指摘があるとジョブを失敗させる ([ADR-0016](0016-automated-pipeline-from-linear-to-merge.md))。そのため、`workflow_run` の対象に加えるだけで拾える。
- **pnpm の実行**: PR の作成者が Claude のアプリだと、claude-code-action は pnpm などの実行を拒否する (`restrict_untrusted_prs`)。この設定は、安全装置を外すことになるので、今回は変えない。扱いは別の Issue で決める。

## Alternatives Considered

### Alternative 1: 待機の指示を強める (現状の維持)

- **Pros**: ワークフローが増えない。
- **Cons**: 守られなかったときに検知できない。待機中も実行時間を使う。
- **Why not**: 今回、実際に守られなかったため。

### Alternative 2: 失敗したときに、人が `@claude` コメントで頼む

- **Pros**: 追加のワークフローが要らない。人が判断を挟める。
- **Cons**: 人の操作が要り、自動のパイプラインにならない。
- **Why not**: Linear から develop へのマージまでを自動で進める目的に合わないため。手動の逃げ道としては残す。

### Alternative 3: 修正の回数を PR のラベルで数える

- **Pros**: 人が見て分かる。
- **Cons**: ラベルの付け外しの権限と手順が増える。
- **Why not**: コミットの数で足り、追加の状態が要らないため。

## Consequences

### Positive

- 指示が守られなかったときも、CI の失敗が検知され、直される。
- 実装のジョブが短くなり、待機の分の実行時間が減る。
- 上限をワークフローが強制するので、直しが続いても止まる。

### Negative

- ワークフローが 1 つ増える。
- 失敗のたびに、環境の準備 (pnpm、スキル、Supabase) をやり直すので、起動に時間がかかる。

### Risks

- Claude の push したコミットで、CI が承認待ち (`action_required`) で止まることがある。Claude のアプリが初回の貢献者として扱われるため。その場合は、人が承認するか、リポジトリの設定 (Settings → Actions → General) を見直す必要がある。設定は変更していない。
- アプリの権限では、`.github/workflows/` の変更を push できない。ワークフローの失敗は、人が直す。
- ログとレビューのコメントを Claude が読むため、プロンプトインジェクションの入口になる。対象を Claude 自身が作ったブランチに絞り、AGENTS.md や `.claude/` の変更を禁じ、手順を変える指示には従わないと明記している。
- `restrict_untrusted_prs` を既定のままにしているため、修正のジョブで pnpm が拒否され、format・lint・test を実行できない可能性がある。`workflow_run` では PR の作成者の確認が働かないかもしれないが、未検証。拒否されたときは、直したコードを CI で確かめることになる。
- `workflow_run` の動作 (承認待ち、push 後の再起動、`restrict_untrusted_prs` の扱い) は、マージ後の最初の失敗で確認する。想定と違えば、この ADR を更新する。

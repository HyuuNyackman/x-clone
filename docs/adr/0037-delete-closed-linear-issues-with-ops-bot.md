# ADR-0037: 閉じた Linear の Issue は、Orca の ops の bot が決まりに従って消す

**Date**: 2026-11-28
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

エージェントが作業するようになり、Linear の Issue が速く増える。XCL は数日で約 130 件になり、うち約 115 件は閉じている。閉じた Issue が残り続けると、今の作業が見えにくくなる。
自動アーカイブは最短 1 か月で、終わっていない Project や Cycle の Issue は、それが終わるまでアーカイブされない。画面からは、手でアーカイブできない。
Linear の Issue は GitHub の Issue と同期しているが、Linear で消しても GitHub の Issue は残ることを確かめた。記録は GitHub の Issue と PR、Linear の Project に残る。

## Decision

- 閉じた Issue を、agent-dev-kit の `ops/linear-janitor` が決まりで選んで消す。
  - Completed・Canceled の Project の中の、閉じた Issue を消す。
  - Project に入っていない閉じた Issue は、閉じてから 7 日 (チームごとの設定) で消す。
  - 開いている Issue、`keep` のラベルの付いた Issue、設定で守る Project の Issue は消さない。
- 動かすのは、ワークスペースに 1 つ置く Orca の **ops の bot**。毎日の automation の precheck で候補を探し (AI なし)、候補があるときだけ bot が起きる。bot は候補の中だけを確かめて消し、迷ったら消さずに人に聞く。
- 設定 (チームのキーなど) は git に入れず、bot のフォルダに置く。
- 技術負債の Issue は Project に入れない (AGENTS.md)。7 日で片付く。
- 自動アーカイブは 1 か月のまま併用する。

## Alternatives Considered

### Alternative 1: 決まりだけで動かす (GitHub Actions、Cloudflare Worker、WSL のタイマー、Docker)

- **Pros**: AI を使わず、確実に同じ動きをする。GitHub Actions と Worker は PC に関係なく動く。
- **Cons**: 「開いている PR がある」「記録として残したい」のような例外を、その場で判断できない。WSL のタイマーは Mac で使えない。リポジトリの Actions に置くと、リポジトリごとに要る。
- **Why not**: 候補は決まりで出し、例外の判断と報告だけを bot に任せる形のほうが、安全と手間の釣り合いが良い。候補がない日は AI を呼ばない。

### Alternative 2: Done になったらすぐ消す

- **Pros**: 閉じた Issue がすぐ見えなくなる。
- **Cons**: 週の報告と Project の進み具合から、Issue が消える。
- **Why not**: Project が閉じた後なら、報告も進み具合も済んでいる。

### Alternative 3: 手で一括削除する

- **Pros**: 仕組みが要らない。
- **Cons**: Project を閉じるたびに、人の手間がかかる。忘れると閉じた Issue がたまる。
- **Why not**: 毎日の確認を bot に任せる。手で消してもよい (決まりは同じ)。

### Alternative 4: 消さずに、自動アーカイブだけに任せる

- **Pros**: 何も作らなくて済む。アーカイブした Issue は検索も復元もできる。
- **Cons**: 最短でも 1 か月かかる。終わっていない Project の Issue は、いつまでも残る。
- **Why not**: 片付くまでが遅く、Project の状態に左右される。自動アーカイブは併用する。

## Consequences

### Positive

- 閉じた Issue が残り続けず、今の作業が見やすい。人の手間は、bot の報告を読むことと、迷ったものに答えることだけ。
- 決まりは agent-dev-kit にあり、新しいチームは設定に 1 行足すだけで使える。

### Negative

- 消した Issue へのリンク (ADR や PR の本文の XCL-xx) が、Linear では開けなくなる。内容は GitHub の Issue と PR、Project に残る。
- ops の bot は PC と Orca が動いている間しか動かない。片付けは数日遅れても困らない。

### Risks

- **消し間違い。** 消した Issue は 30 日、Linear の「最近削除した項目」から戻せる。bot は候補の中だけを消し、スクリプトも消す直前に候補かを確かめ直す。
- **Linear の API の書き方 (Project の状態の取り方) を、まだ本物で確かめていない。** 最初は `check` だけを人が実行して確かめる。

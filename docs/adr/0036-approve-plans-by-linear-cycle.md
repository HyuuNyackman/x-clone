# ADR-0036: エージェントの計画は、Linear の Cycle の Issue を Todo に動かして承認する

**Date**: 2026-11-27
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

Orca の Manager は、計画を人に承認されてから、ワーカーを起動する ([ADR-0035](0035-move-agent-work-to-orca.md))。試運転 (XCL-118) では、チャットで「承認」と返す形にした。これは Manager が止まって待つ約束でしかなく、記録もチャットにしか残らない。
人が見るタイミングを決めたい。`develop` へは自動でマージされ、人が見るのは `develop → main` のリリースだけ (ADR-0016)。

## Decision

- Manager は、計画した Issue を**次の Cycle** に、状態 **Backlog** で入れる。
- 人は Cycle の画面で、実行してよい Issue を **Todo** に動かす。これを承認とする。
- Manager が起動してよいのは、**今の Cycle の Todo の Issue だけ**。Manager は Issue を Todo に動かさず、状態も変えない。状態は Linear の GitHub 連携が動かす (コミットか PR で In Progress、マージで Done)。
- Cycle の終わりに、Manager (または Reporter) が結果と次の Cycle の案を出し、人が `develop → main` をマージする。人が見るのは、Cycle の始め (計画) と終わり (リリース) の 2 回。
- Todo のまま次の Cycle に移った Issue は、承認が続いているとみなす。外すときは、人が Backlog に戻す。

## Alternatives Considered

### Alternative 1: チャットで承認する

- **Pros**: 手軽。
- **Cons**: 記録がチャットにしか残らない。Manager が約束を破っても止められない。
- **Why not**: 状態の正本の Linear に、承認の記録も置きたい。

### Alternative 2: Orca の判断ゲート (`gate-create`) で承認する

- **Pros**: Orca の側で、承認までタスクの起動を止められる。
- **Cons**: Orca を開いて答える必要がある。記録が Orca にしか残らない。
- **Why not**: Linear なら、スマホからでも 1 件ずつ承認できる。Orca の判断ゲートは、実行の途中の判断に使う。

### Alternative 3: Cycle が始まったら承認とみなす

- **Pros**: 人の操作が要らない。
- **Cons**: 日付が来ただけで、見ていない計画が動く。
- **Why not**: 承認には、人の操作を必ず挟む。

## Consequences

### Positive

- 承認の記録が Linear に残る。人が見るタイミングが、Cycle の始めと終わりに決まる。
- Manager が Linear の状態を変えないので、その分のトークンと手順が減る。

### Negative

- Orca の bot は持ち主の Linear の操作では起きないので、Todo に動かしただけでは Manager は動かない。チャットで伝えるか、定期実行で起こす。

### Risks

- **定期実行で起こすときの precheck (Todo があるときだけ AI を呼ぶ) は、まだ試していない。** `orca linear` は、Orca に Linear の API キーを入れてから使える (XCL-124)。
- **承認していない Cycle を、Cycle の開始日を遅らせて待つ仕組みはない。** 未承認の Issue は Backlog のまま動かないので、安全側に倒れる。

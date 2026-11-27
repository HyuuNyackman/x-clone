# ADR-0036: エージェントの作業は Linear の Project でまとめ、Project の状態で承認する

**Date**: 2026-11-28
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

Orca の Manager は、計画を人に承認されてから、ワーカーを起動する ([ADR-0035](0035-move-agent-work-to-orca.md))。試運転 (XCL-118) では、チャットで「承認」と返す形にした。これは Manager が止まって待つ約束でしかなく、記録もチャットにしか残らない。
人が見るタイミングも決めたい。`develop` へは自動でマージされ、人が見るのは `develop → main` のリリースだけ (ADR-0016)。

## Decision

- **作業のまとまりは Linear の Project** にする。1 つの機能・目的ごとに Manager が作り、説明は agent-dev-kit の `templates/project.md` で書く。大きな Project は、マイルストーンで段階に分けてよい。
- **承認は Project の状態で表す。** Manager は Project を **Planned** で作る。人が **In Progress** にしたら承認。Project の状態を変えるのは人だけ。
- Manager が起動してよいのは、In Progress の Project にあり、まだ着手していない (Backlog か Todo) Issue で、`human:decision`・`human:task` が付いていないもの。Issue の状態は Linear の GitHub 連携が動かし、Manager は変えない。
- **承認の後に Issue を足すとき**、人の指示がなければ、Manager は `human:decision` を付ける。人がラベルを外すと、その Issue の承認になる。
- Project の Issue がすべて Done になったら、Manager が報告し (Project update にも残す)、人が `develop → main` をマージして、Project を Completed にする。人が見るのは、Project の始め (計画) と終わり (リリース) の 2 回。

## Alternatives Considered

### Alternative 1: チャットで承認する

- **Pros**: 手軽。
- **Cons**: 記録がチャットにしか残らない。Manager が約束を破っても止められない。
- **Why not**: 状態の正本の Linear に、承認の記録も置きたい。

### Alternative 2: Cycle に入れ、Issue を Todo に動かして承認する

- **Pros**: 期間で区切れる。Cycle の画面でまとめて扱える。
- **Cons**: Linear は、Backlog の Issue を Cycle に入れると Todo に動かす (XCL-132 で確かめ、ドキュメントにも書かれている)。Todo を承認の印にできない。Cycle は日付の区切りで、作業のまとまりと合わない。Manager の Linear の接続からは、Cycle を作ることも書き換えることもできない。
- **Why not**: 承認の印とまとまりの両方が合わない。

### Alternative 3: Issue の状態「Ready」を足し、Issue ごとに承認する

- **Pros**: Issue ごとに承認の記録が残る。
- **Cons**: Issue を 1 件ずつ (またはスクリプトで) 動かす手間がかかる。Linear のチームに状態を足す必要がある。
- **Why not**: 一人の開発では、Project 単位の承認で足りる。外したい Issue は `human:*` で外せる。

### Alternative 4: マイルストーンでまとめる

- **Pros**: Manager から作れ、説明と目標日を持てる。
- **Cons**: 状態を持たないので、承認の印には別の仕組みが要る。1 つの Project の中でしか使えない。
- **Why not**: Project のほうが、状態・説明・ドキュメント・Project update を持ち、要件からリリースまでの単位に合う。マイルストーンは、Project の中の段階に使う。

## Consequences

### Positive

- 承認はクリック 1 回で、記録が Linear に残る。人が見るタイミングが、Project の始めと終わりに決まる。
- 要件・設計メモ・報告を、Project にまとめて置ける。
- Manager が Issue の状態を変えないので、その分の手順とトークンが減る。

### Negative

- Project 単位の承認なので、Issue ごとの承認の記録は残らない。外した Issue は `human:*` のラベルで分かる。
- Orca の bot は持ち主の Linear の操作では起きないので、Project を In Progress にしただけでは Manager は動かない。チャットで伝えるか、定期実行で起こす。

### Risks

- **承認の後に足した Issue が、承認なしで動くおそれ。** Manager が `human:decision` を付ける決まりで防ぐ。付け忘れると動いてしまうので、Scout の見張りの対象に入れる。
- **定期実行で起こすときの precheck (起動してよい Issue があるときだけ AI を呼ぶ) は、まだ作っていない。** `orca linear` は、Orca に Linear の API キーを入れてから使える (XCL-124)。

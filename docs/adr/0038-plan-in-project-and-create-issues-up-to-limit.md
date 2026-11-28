# ADR-0038: 計画は Project の説明に書き、Issue は決めた件数まで作る

**Date**: 2026-11-28
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

Manager は Project を作るとき、計画した Issue をすべて先に作っていた (ADR-0036)。計画が大きいと、まだ着手しない Issue で Linear の一覧が埋まり、今の作業が見えにくくなる。
閉じた Issue は janitor が消すが (ADR-0037)、In Progress の Project の Issue は、Project を閉じるまで残る。

## Decision

- Linear に置く Issue の上限を、ops の bot の設定 (`maxIssues`) で決める。janitor の `count` が、今の数と空きを出す (AI なし)。
- Manager は計画を **Project の説明の「Issue」の一覧** に書く。まだ Issue にしない項目は `未作成:` で始め、承認できるだけの中身 (目的・受け入れ条件の要点・依存・ラベル) を書く。
- Issue を作る前に `count` で数え、空きの分だけ、依存の順に作る。作った項目は、一覧の `未作成:` を Issue の ID に置き換える。
- 人が Project を In Progress にすると、`未作成:` の項目も含めて一覧の全体を承認したことになる。一覧から後で作った Issue には `human:decision` を付けない。一覧にない Issue を足すときは、今までどおり付ける (ADR-0036)。
- 空きは、janitor が閉じた Project の Issue を消すと増える。Manager は起こされたときに数え直し、続きを作る。

## Alternatives Considered

### Alternative 1: 今までどおり、計画した Issue をすべて先に作る

- **Pros**: 承認のときに、Issue の中身 (テストケースまで) を見られる。
- **Cons**: 計画が大きいほど、着手しない Issue が一覧に並ぶ。
- **Why not**: 承認に要るのは、目的・受け入れ条件の要点・依存。テストケースは Issue を作るときに書けばよい。

### Alternative 2: まだ着手しない項目を、Linear のドキュメントやマイルストーンの説明に書く

- **Pros**: Project の説明が長くならない。
- **Cons**: 計画と承認の場所が分かれ、人が見る場所が増える。
- **Why not**: Project の説明は承認のときに人が見る場所なので、そこに一覧をまとめる。

## Consequences

### Positive

- Linear には、作業中とすぐ着手する Issue だけが並ぶ。
- 計画は 1 か所 (Project の説明) にあり、どこまで Issue にしたかがわかる。Project を閉じると、説明ごと vault に残る (ADR-0037)。

### Negative

- `未作成:` の項目は、Issue になるまで Linear の検索や依存の関係に出ない。
- 一覧と Issue の対応を、Manager が手で書き換える。

### Risks

- **大きな Project では、Done の Issue が Project を閉じるまで数に入り、空きが尽きる。** 大きな計画は Project を分ける。空きがないときは、Manager が人に伝える。
- **`未作成:` の中身が薄いと、承認が形だけになる。** テンプレート (`templates/project.md`) に、書く項目を決めてある。

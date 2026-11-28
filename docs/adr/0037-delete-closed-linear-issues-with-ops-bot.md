# ADR-0037: 閉じた Linear の Issue は、Obsidian に残してから Orca の ops の bot が消す

**Date**: 2026-11-28
**Status**: accepted
**Deciders**: HyuuNyackman
**Updated**: 2026-11-28 (消す前に Obsidian の vault に残す。XCL-140)

## Context

エージェントが作業するようになり、Linear の Issue が速く増える。XCL は数日で約 130 件になり、うち約 115 件は閉じている。閉じた Issue が残り続けると、今の作業が見えにくくなる。
自動アーカイブは最短 1 か月で、終わっていない Project や Cycle の Issue は、それが終わるまでアーカイブされない。画面からは、手でアーカイブできない。
Linear の Issue は GitHub の Issue と同期しているが、Linear で消しても GitHub の Issue は残ることを確かめた。ただし、Linear のコメント、Project とマイルストーンと親子のつながりは、GitHub に残らない。

## Decision

- 閉じた Issue を、agent-dev-kit の `ops/linear-janitor` が決まりで選んで消す。
  - Completed・Canceled の Project の中の、閉じた Issue を消す。
  - Project に入っていない閉じた Issue は、閉じてから 7 日 (チームごとの設定) で消す。
  - 開いている Issue、`keep` のラベルの付いた Issue、設定で守る Project の Issue は消さない。
- 動かすのは、ワークスペースに 1 つ置く Orca の **ops の bot**。毎日の automation の precheck で候補を探し (AI なし)、候補があるときだけ bot が起きる。bot は候補の中だけを確かめて消し、迷ったら消さずに人に聞く。
- 消す前に、Issue と Project を **Obsidian の vault** に Markdown で書く。書けなければ消さない。
  - Issue のノートには、説明・コメント・状態・ラベル・GitHub の Issue と PR のリンク、Project・マイルストーン・親子・関連へのリンクを書く。Project のノートには、説明と、Issue をマイルストーンごとに並べた一覧を書く。画像は残さない。
  - vault は開発以外のメモにも使う 1 つのもので、private の git リポジトリで同期する (Obsidian Git)。janitor はファイルを書くだけで、git には触らない。
- 設定 (チームのキー、vault の場所など) は git に入れず、bot のフォルダに置く。
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

### Alternative 4: 消す前に CSV に書き出す

- **Pros**: 作りが単純で、Excel で開ける。
- **Cons**: コメントや、Project・マイルストーン・親子のつながりを表しにくい。書き出した後に読み返さない。
- **Why not**: Obsidian のノートなら、リンクでつながりをたどれ、ほかのメモと一緒に探せる。最初は CSV で作り、Obsidian に替えた。

### Alternative 5: Obsidian の Linear の同期プラグイン

- **Pros**: 作らなくて済む。今の Issue も Obsidian で見られる。
- **Cons**: Obsidian が開いている間しか動かない。双方向の同期は、ノートの変更で Linear の Issue を書き換えうる。Linear で消したときにノートが残るかが書かれていない。保守が少ない。
- **Why not**: 必要なのは「消す直前に確実に残す」ことで、janitor が消す前に書けば足りる。

### Alternative 6: 消さずに、自動アーカイブだけに任せる

- **Pros**: 何も作らなくて済む。アーカイブした Issue は検索も復元もできる。
- **Cons**: 最短でも 1 か月かかる。終わっていない Project の Issue は、いつまでも残る。
- **Why not**: 片付くまでが遅く、Project の状態に左右される。自動アーカイブは併用する。

## Consequences

### Positive

- 閉じた Issue が残り続けず、今の作業が見やすい。人の手間は、bot の報告を読むことと、迷ったものに答えることだけ。
- 決まりは agent-dev-kit にあり、新しいチームは設定に 1 行足すだけで使える。

### Negative

- 消した Issue へのリンク (ADR や PR の本文の XCL-xx) が、Linear では開けなくなる。内容は vault と、GitHub の Issue と PR に残る。
- vault の作成と同期 (Obsidian と Obsidian Git) を、PC ごとに人が用意する。
- ops の bot は PC と Orca が動いている間しか動かない。片付けは数日遅れても困らない。

### Risks

- **消し間違い。** 消した Issue は 30 日、Linear の「最近削除した項目」から戻せる。bot は候補の中だけを消し、スクリプトも消す直前に候補かを確かめ直す。
- **vault に書いたノートは、Obsidian が開いて push するまで、その PC にしかない。** その間に PC が壊れると失われる。消した Issue は 30 日、Linear から戻せる。
- vault の場所が変わると、janitor は消さずに止まる (vault がないときは消さない)。bot が報告するので、設定を直す。

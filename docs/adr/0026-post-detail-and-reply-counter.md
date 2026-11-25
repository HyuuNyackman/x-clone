# ADR-0026: 投稿詳細は /post/[id] の画面にし、リプライ数は posts.reply_count をトリガーで更新する

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-57 で、投稿詳細画面 (元投稿とリプライ一覧) とリプライ投稿を作り、リプライ数を表示する。`posts.reply_to` は [ADR-0019](0019-posts-table-and-rls.md) で用意済み。いいね数は [ADR-0022](0022-likes-table-and-counter-trigger.md) でカウンタ列とトリガーにしている。

## Decision

- 詳細画面は `src/app/post/[id].tsx` (ルートスタックの通常の画面) にする。タイムラインのカードを押すと開く。
- リプライは、通常の投稿と同じ `posts` への insert に `reply_to` を付けるだけで作る。`createPost` に任意の `replyTo` を足した。
- `posts.reply_count` (`integer not null default 0`、0 以上の CHECK) を足し、`posts` の insert / delete のトリガー (`security definer`、execute は誰にも付けない) で、`reply_to` の先を増減する。作成ポリシーに `reply_count = 0` を足し、作成時にカウンタを偽れないようにする。
- `get_timeline` は戻り値に `reply_count` を足す。戻り値の形が変わるので、関数を作り直して権限を付け直す。
- リプライ一覧は、`reply_to` で絞って古い順に最大 100 件を読む (部分インデックス `(reply_to, created_at, id)`)。
- リプライの送信中は、一覧の末尾に仮のリプライを出し、元投稿のカウンタも +1 する (楽観的更新)。失敗したら戻し、確定後は一覧・元投稿・タイムラインを取り直す。

## Alternatives Considered

### Alternative 1: リプライ数を都度 `count(*)` する

- **Pros**: カウンタのずれが起きない。
- **Cons**: タイムラインの取得ごとに集計が走る。
- **Why not**: いいね数と同じ理由で、読み取りを軽くしたい。

### Alternative 2: リプライ専用のテーブルを作る

- **Pros**: 投稿とリプライを分けて扱える。
- **Cons**: 投稿の種類は `posts` の列の制約で表す方針 (ADR-0019) と食い違い、リプライへのリプライで構造が二重になる。
- **Why not**: `reply_to` だけで足りる。

## Consequences

### Positive

- リプライ数は API から直接変えられず、DB が一貫して保つ。リプライへのリプライも同じ画面で辿れる。

### Negative

- リプライのたびに元投稿の行を更新するので、人気の投稿では行ロックの競合が起きうる。
- リプライ一覧は最大 100 件で、ページ送りがない。

### Risks

- 挙動は `supabase/tests/database/replies.test.sql` の pgTAP で、CI のローカル Supabase に対して確かめる。
- カウンタがずれたときの再集計の手段はまだない。
- 元の投稿が消えると、リプライは `reply_to` が null になって残るが、どの画面からも辿れなくなる。

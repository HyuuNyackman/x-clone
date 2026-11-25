# ADR-0029: 「フォロー中」タブは get_timeline の引数で絞り、フォロー状態は別クエリで持つ

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-106 で、フォロー・解除ボタンと、タイムラインの「フォロー中」タブを作る。タイムラインは RPC `get_timeline` ([ADR-0021](0021-timeline-rpc-keyset-pagination.md)) で読んでおり、フォロー中の人の投稿だけに絞る手段が要る。また、カードにフォロー済みかを出すには、自分のフォロー先を知る必要がある。

## Decision

- `get_timeline` に `p_following_only boolean default false` を足す。true のとき、`follows` に自分 (`auth.uid()`) の行がある投稿者の投稿だけを返す (自分の投稿は含めない)。引数が増えるので、関数を作り直して権限を付け直す ([ADR-0028](0028-like-button-optimistic-update.md) と同じ手順)。security invoker のまま、`follows_select_all` が効く。
- 「おすすめ」は引数なし (全体のまま)。タブごとにクエリキーを分ける (`['posts','timeline']` と `['posts','timeline','following']`)。いいね・削除の楽観的更新は、前方一致 (`setQueriesData`) で両方のタブに反映する。
- 自分のフォロー先の id は `useFollowingIds` で別に取り、カードの「フォロー / フォロー中」の表示に使う。`get_timeline` の戻り値は変えない。
- フォロー・解除は `useToggleFollow` (楽観的更新、`scope` で直列化)。二重フォローは複合主キーの重複 (23505) を成功として扱い、解除は無い行の delete が 0 件で成功するので安全。完了後に「フォロー中」タブも取り直す。
- フォローボタンは、他人の投稿カードに出す。プロフィール画面 (他人) がまだ無いため。

## Alternatives Considered

### Alternative 1: 戻り値に `followed_by_me` を足す

- **Pros**: 取得が 1 回で済む。
- **Cons**: 戻り値の形がまた変わる。詳細・リプライ一覧 (`posts` を直接読む) には別の手当てが要る。
- **Why not**: フォロー先の id は少なく、別クエリで十分。

### Alternative 2: クライアントで投稿を絞る

- **Pros**: RPC の変更が要らない。
- **Cons**: ページ送りで件数が不揃いになり、フォロー中の投稿が少ないと空ページが続く。
- **Why not**: DB 側で絞るほうが、keyset ページネーションと整合する。

## Consequences

### Positive

- フォローした人の投稿だけが「フォロー中」に出て、ページ送りも崩れない。

### Negative

- フォロー先の id を全件読むので、フォロー数が多いと重くなる。
- 「フォロー中」で他人のフォローを解除しても、その場では一覧から消えず、取り直しで消える。

### Risks

- この変更は作業環境でローカルの Supabase を起動できず、`supabase test db` を手元では実行していない (CI で確かめる)。

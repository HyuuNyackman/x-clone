# ADR-0032: 通知だけを Realtime で購読し、INSERT を合図に取り直す

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

XCL-61 で通知画面と未読バッジを作る。別端末の操作が数秒以内に反映される必要がある。一方、Supabase の無料枠にはメッセージ数と同時接続の制限がある。

## Decision

- `notifications` だけを `supabase_realtime` の publication に入れる。タイムライン系のテーブルは入れない。
- クライアントは `user_id=eq.<自分>` の INSERT だけを購読する。RLS により他人の行は届かない。
- 届いたイベントの中身は使わず、通知一覧と未読数のクエリを invalidate して取り直す (一覧は投稿者名や本文の埋め込みが要るため)。購読が確立 (再接続を含む) したときも取り直す。
- チャンネルはタブのレイアウトで 1 本だけ張る。ログアウトやアンマウントで外す。
- 既読化は楽観的に更新する。個別 (`id` 指定) と全件があり、どちらも `read_at is null` の行だけ更新する。

## Alternatives Considered

### Alternative 1: 定期ポーリング

- **Pros**: 接続数を使わない。
- **Cons**: 数秒以内に反映するには短い間隔が必要で、リクエストが増える。
- **Why not**: 完了条件の「数秒以内」を無駄なく満たすには Realtime が向く。

### Alternative 2: イベントの payload を直接キャッシュに入れる

- **Pros**: 追加のリクエストが要らない。
- **Cons**: payload には投稿者名や本文が無く、結局取り直しが要る。
- **Why not**: 実装が複雑になる割に得が小さい。

## Consequences

### Positive

- 同時接続は 1 ユーザー 1 チャンネル、メッセージは自分宛ての INSERT だけに抑えられる。

### Negative

- イベントのたびに 2 本のクエリが走る。

### Risks

- 作業環境でローカルの Supabase を起動できず、`supabase test db` と、別端末での数秒以内の反映は未確認 (CI と実機で確かめる)。
- 一覧は最新 50 件までで、ページネーションは未対応。

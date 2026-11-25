-- タイムライン取得 RPC (XCL-55)。全体の新着順を keyset ページネーション ((created_at, id) のカーソル) で返す。
-- security invoker なので、呼んだ人の権限と RLS (posts_select_all) がそのまま効く。
-- 関数は既定で public (anon を含む) に execute が付くので、いったん外して authenticated にだけ付ける。
-- リポスト (repost_of あり) は本文が空なので除く。いいね数・リプライ数などは、各テーブルができた後で足す。

create function public.get_timeline(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20
)
returns table (
  id uuid,
  author_id uuid,
  body text,
  reply_to uuid,
  quote_of uuid,
  created_at timestamptz,
  handle text,
  display_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.author_id,
    p.body,
    p.reply_to,
    p.quote_of,
    p.created_at,
    pr.handle,
    pr.display_name
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.repost_of is null
    -- カーソルが無ければ先頭から。あれば、そのカーソルより古いものだけ。
    and (
      p_before_created_at is null
      or (p.created_at, p.id) < (p_before_created_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

revoke execute on function public.get_timeline(timestamptz, uuid, int) from public, anon;
grant execute on function public.get_timeline(timestamptz, uuid, int) to authenticated;

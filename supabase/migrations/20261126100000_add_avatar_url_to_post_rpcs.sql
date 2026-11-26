-- get_timeline / search_posts の戻り値に avatar_url を足す (XCL-117)。
-- 投稿カードに投稿者のアバターを出すため。戻り値の列が変わるので、関数を作り直して権限を付け直す。
-- security invoker のまま。profiles は全員が読める (profiles の RLS) ので、権限の範囲は変わらない。

drop function public.get_timeline(timestamptz, uuid, int, boolean);
drop function public.search_posts(text, timestamptz, uuid, int);

create function public.get_timeline(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20,
  p_following_only boolean default false
)
returns table (
  id uuid,
  author_id uuid,
  body text,
  reply_to uuid,
  quote_of uuid,
  created_at timestamptz,
  handle text,
  display_name text,
  avatar_url text,
  reply_count integer,
  like_count integer,
  liked_by_me boolean
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
    pr.display_name,
    pr.avatar_url,
    p.reply_count,
    p.like_count,
    exists (
      select 1 from public.likes l
      where l.post_id = p.id and l.user_id = (select auth.uid())
    ) as liked_by_me
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.repost_of is null
    and (
      not coalesce(p_following_only, false)
      or exists (
        select 1 from public.follows f
        where f.followee_id = p.author_id and f.follower_id = (select auth.uid())
      )
    )
    and (
      p_before_created_at is null
      or (p.created_at, p.id) < (p_before_created_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

create function public.search_posts(
  p_query text,
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
  display_name text,
  avatar_url text,
  reply_count integer,
  like_count integer,
  liked_by_me boolean
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
    pr.display_name,
    pr.avatar_url,
    p.reply_count,
    p.like_count,
    exists (
      select 1 from public.likes l
      where l.post_id = p.id and l.user_id = (select auth.uid())
    ) as liked_by_me
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.repost_of is null
    and char_length(btrim(coalesce(p_query, ''))) >= 1
    and p.body ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and (
      p_before_created_at is null
      or (p.created_at, p.id) < (p_before_created_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

revoke execute on function public.get_timeline(timestamptz, uuid, int, boolean) from public, anon;
grant execute on function public.get_timeline(timestamptz, uuid, int, boolean) to authenticated;
revoke execute on function public.search_posts(text, timestamptz, uuid, int) from public, anon;
grant execute on function public.search_posts(text, timestamptz, uuid, int) to authenticated;

-- 検索の RPC とインデックス (XCL-67)。pg_trgm の GIN インデックスで、投稿本文とユーザー (handle・表示名) を部分一致検索する。
-- 検索は ilike (大文字小文字を区別しない部分一致) で書く。gin_trgm_ops のインデックスが ilike に効く。
-- 日本語での精度の限界は docs/search-japanese.md に書いた。

create extension if not exists pg_trgm with schema extensions;

create index posts_body_trgm_idx on public.posts using gin (body extensions.gin_trgm_ops);
create index profiles_handle_trgm_idx on public.profiles using gin (handle extensions.gin_trgm_ops);
create index profiles_display_name_trgm_idx on public.profiles using gin (display_name extensions.gin_trgm_ops);

-- 投稿の検索。戻り値は get_timeline と同じ形 (カードをそのまま使えるように)。
-- like のワイルドカード (% _ \) は検索語の一部として扱うため、エスケープする。
-- 空白だけの検索語は、何も返さない。リポストは本文がないので対象外。
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

-- ユーザーの検索 (handle または表示名)。handle の前方一致を先に、次に handle 順で返す。
create function public.search_users(
  p_query text,
  p_limit int default 20
)
returns table (
  id uuid,
  handle text,
  display_name text,
  avatar_url text,
  bio text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select pr.id, pr.handle, pr.display_name, pr.avatar_url, pr.bio
  from public.profiles pr
  where char_length(btrim(coalesce(p_query, ''))) >= 1
    and (
      pr.handle ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or pr.display_name ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by
    (pr.handle ilike replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%') desc,
    pr.handle asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

revoke execute on function public.search_posts(text, timestamptz, uuid, int) from public, anon;
grant execute on function public.search_posts(text, timestamptz, uuid, int) to authenticated;
revoke execute on function public.search_users(text, int) from public, anon;
grant execute on function public.search_users(text, int) to authenticated;

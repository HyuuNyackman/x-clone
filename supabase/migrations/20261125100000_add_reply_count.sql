-- リプライ数のカウンタ (XCL-57)。posts.reply_to を使い、リプライの insert / delete でトリガーが増減する。
-- likes (XCL-56) と同じく、カウンタは API から直接変えられない。

alter table public.posts add column reply_count integer not null default 0;
alter table public.posts add constraint posts_reply_count_nonnegative check (reply_count >= 0);

-- 作成時にカウンタを偽れないよう、作成ポリシーに reply_count = 0 を足す。
drop policy "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  to authenticated
  with check ((select auth.uid()) = author_id and like_count = 0 and reply_count = 0);

-- 投稿詳細でリプライを引くためのインデックス (新しい順ではなく、古い順に並べる)。
create index posts_reply_to_created_at_idx on public.posts (reply_to, created_at, id) where reply_to is not null;

-- カウンタ更新。authenticated には posts の update 権限が無いので security definer で動かす。
create function public.update_post_reply_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.reply_to is not null then
      update public.posts set reply_count = reply_count + 1 where id = new.reply_to;
    end if;
    return new;
  else
    if old.reply_to is not null then
      update public.posts set reply_count = greatest(reply_count - 1, 0) where id = old.reply_to;
    end if;
    return old;
  end if;
end;
$$;

revoke execute on function public.update_post_reply_count() from public, anon, authenticated;

create trigger on_reply_changed
  after insert or delete on public.posts
  for each row execute function public.update_post_reply_count();

-- get_timeline に reply_count を足す。戻り値の形が変わるので、作り直す。
drop function public.get_timeline(timestamptz, uuid, int);

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
  display_name text,
  reply_count integer
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
    p.reply_count
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.repost_of is null
    and (
      p_before_created_at is null
      or (p.created_at, p.id) < (p_before_created_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
$$;

revoke execute on function public.get_timeline(timestamptz, uuid, int) from public, anon;
grant execute on function public.get_timeline(timestamptz, uuid, int) to authenticated;

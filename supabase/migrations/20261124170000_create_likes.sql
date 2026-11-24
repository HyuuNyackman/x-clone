-- likes テーブル・RLS・いいね数カウンタ (XCL-56)。
-- Data API の自動許可が OFF なので、GRANT・RLS 有効化・ポリシーを1セットで書く。

-- posts にいいね数のカウンタ列を足す。更新はトリガーだけが行う。
alter table public.posts add column like_count integer not null default 0;
alter table public.posts add constraint posts_like_count_nonnegative check (like_count >= 0);

-- posts には insert の GRANT がテーブル全体に付いているので、作成時にカウンタを偽れないよう
-- 作成ポリシーに like_count = 0 を足す (update の GRANT は無いので、作成後は変えられない)。
drop policy "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  to authenticated
  with check ((select auth.uid()) = author_id and like_count = 0);

-- 複合主キー (user_id, post_id) で二重いいねを防ぐ。
create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- 投稿ごとのいいね数・いいね一覧用 (主キーは user_id が先頭なので post_id からは引けない)。
create index likes_post_id_idx on public.likes (post_id);

-- GRANT: update は不要。anon には何も付けない。
grant select, insert, delete on public.likes to authenticated;

alter table public.likes enable row level security;

create policy "likes_select_all"
  on public.likes for select
  to authenticated
  using (true);

create policy "likes_insert_own"
  on public.likes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "likes_delete_own"
  on public.likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- カウンタ更新。authenticated には posts の update 権限が無いので security definer で動かす。
create function public.update_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end;
$$;

revoke execute on function public.update_post_like_count() from public, anon, authenticated;

create trigger on_like_changed
  after insert or delete on public.likes
  for each row execute function public.update_post_like_count();

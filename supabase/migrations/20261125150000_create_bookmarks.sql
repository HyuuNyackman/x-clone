-- bookmarks テーブル・RLS (XCL-68)。
-- Data API の自動許可が OFF なので、GRANT・RLS 有効化・ポリシーを1セットで書く。
-- ブックマークは本人だけのもの。他人のブックマークは閲覧も操作もできない。

-- 複合主キー (user_id, post_id) で二重ブックマークを防ぐ。
-- 一覧は user_id で引くので、主キーのインデックスで足りる。
create table public.bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- 投稿を消したときの連鎖削除で post_id から引くため。
create index bookmarks_post_id_idx on public.bookmarks (post_id);

-- GRANT: update は不要。anon には何も付けない。
grant select, insert, delete on public.bookmarks to authenticated;

alter table public.bookmarks enable row level security;

create policy "bookmarks_select_own"
  on public.bookmarks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "bookmarks_insert_own"
  on public.bookmarks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "bookmarks_delete_own"
  on public.bookmarks for delete
  to authenticated
  using ((select auth.uid()) = user_id);

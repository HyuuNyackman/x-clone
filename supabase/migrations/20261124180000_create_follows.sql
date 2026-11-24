-- follows テーブル・RLS・自己フォロー禁止 (XCL-58)。
-- Data API の自動許可が OFF なので、GRANT・RLS 有効化・ポリシーを1セットで書く。

-- 複合主キー (follower_id, followee_id) で二重フォローを防ぐ。
-- check 制約で自分自身のフォローを禁止する。
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self_follow check (follower_id <> followee_id)
);

-- フォロワー一覧用 (主キーは follower_id が先頭なので followee_id からは引けない)。
create index follows_followee_id_idx on public.follows (followee_id);

-- GRANT: update は不要。anon には何も付けない。
grant select, insert, delete on public.follows to authenticated;

alter table public.follows enable row level security;

create policy "follows_select_all"
  on public.follows for select
  to authenticated
  using (true);

create policy "follows_insert_own"
  on public.follows for insert
  to authenticated
  with check ((select auth.uid()) = follower_id);

create policy "follows_delete_own"
  on public.follows for delete
  to authenticated
  using ((select auth.uid()) = follower_id);

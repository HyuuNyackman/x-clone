-- profiles テーブル、RLS、サインアップ時の自動作成トリガー (XCL-50)。
-- Data API の自動許可が OFF なので、GRANT・RLS 有効化・ポリシーを1セットで書く。

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  display_name text not null,
  avatar_url text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  constraint profiles_handle_key unique (handle),
  -- 小文字の英数字とアンダースコアで 3〜15 文字
  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,15}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 50),
  constraint profiles_bio_length check (char_length(bio) <= 160)
);

-- GRANT: insert は自動作成トリガーが行うので付けない。
-- update は列を絞り、id と created_at は変更させない。
grant select on public.profiles to anon, authenticated;
grant update (handle, display_name, avatar_url, bio) on public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- auth.users の作成時に profiles を自動作成する。
-- 初期 handle は user_ + uuid 先頭 10 桁 (15 文字)。ユーザーが後から変更する。
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  initial_handle text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    initial_handle,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'name', 50), ''), initial_handle)
  );
  return new;
end;
$$;

-- トリガー専用。API から直接呼べないようにする。
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

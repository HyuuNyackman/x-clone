-- posts テーブルと RLS (XCL-53)。リプライ・引用・リポストの列を含む。
-- Data API の自動許可が OFF なので、GRANT・RLS 有効化・ポリシーを1セットで書く。
-- 主キーは uuid (gen_random_uuid) なので、シーケンスへの GRANT は要らない。

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- リポストは本文なし (空文字)。それ以外は 1〜280 文字。
  body text not null default '',
  -- 元の投稿が消えても、リプライと引用は残す。リポストは元がなくなると意味がないので連鎖削除する。
  reply_to uuid references public.posts (id) on delete set null,
  quote_of uuid references public.posts (id) on delete set null,
  repost_of uuid references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint posts_body_length check (char_length(body) <= 280),
  -- リプライ・引用・リポストは、同時に 2 つ以上指定できない。
  constraint posts_single_kind check (num_nonnulls(reply_to, quote_of, repost_of) <= 1),
  constraint posts_body_required check (
    case
      when repost_of is not null then body = ''
      else char_length(btrim(body)) >= 1
    end
  )
);

-- keyset ページネーション用 (created_at, id)。
create index posts_created_at_id_idx on public.posts (created_at, id);

-- GRANT: 編集機能はないので update は付けない。
-- 未ログイン (anon) には何も付けない。
grant select, insert, delete on public.posts to authenticated;

alter table public.posts enable row level security;

create policy "posts_select_all"
  on public.posts for select
  to authenticated
  using (true);

create policy "posts_insert_own"
  on public.posts for insert
  to authenticated
  with check ((select auth.uid()) = author_id);

create policy "posts_delete_own"
  on public.posts for delete
  to authenticated
  using ((select auth.uid()) = author_id);

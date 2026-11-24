-- post_media テーブル・RLS (XCL-62)。投稿に紐付く画像を持つ。
-- DB には URL ではなく、保存先に依存しないキー (storage_key) だけを持つ。表示 URL はアプリ側で組み立てる。
-- Data API の自動許可が OFF なので、GRANT・RLS 有効化・ポリシーを1セットで書く。

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  -- 例: "posts/<post_id>/0.jpg"。保存先 (Supabase Storage / R2 など) やドメインは含めない。
  storage_key text not null,
  width integer not null,
  height integer not null,
  -- 表示順。1 投稿につき最大 4 枚 (0〜3)。同じ投稿で順序は重複しない。
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint post_media_storage_key_format check (
    char_length(storage_key) between 1 and 512
    and storage_key !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:'
    and storage_key !~ '^/'
  ),
  constraint post_media_size_positive check (width > 0 and height > 0),
  constraint post_media_sort_order_range check (sort_order between 0 and 3),
  constraint post_media_post_sort_unique unique (post_id, sort_order)
);

-- unique 制約の索引 (post_id, sort_order) が post_id からの検索を兼ねるので、追加の索引は不要。

-- GRANT: 画像の差し替えは削除して作り直すので update は付けない。anon には何も付けない。
grant select, insert, delete on public.post_media to authenticated;

alter table public.post_media enable row level security;

create policy "post_media_select_all"
  on public.post_media for select
  to authenticated
  using (true);

-- 紐付け先の投稿の投稿者本人だけが作成・削除できる。
create policy "post_media_insert_own"
  on public.post_media for insert
  to authenticated
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = (select auth.uid())
    )
  );

create policy "post_media_delete_own"
  on public.post_media for delete
  to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = (select auth.uid())
    )
  );

-- post_media テーブルの構造・権限・RLS を確かめる (XCL-62)。
-- 対象のマイグレーション: 20261124190000_create_post_media.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)

begin;

select plan(26);

-- ===== 構造 =====

select has_table('public', 'post_media', 'post_media テーブルがある');
select columns_are(
  'public', 'post_media',
  array['id', 'post_id', 'storage_key', 'width', 'height', 'sort_order', 'created_at'],
  'post_media の列が想定どおり'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.post_media'::regclass),
  'post_media の RLS が有効'
);
select policies_are(
  'public', 'post_media',
  array['post_media_select_all', 'post_media_insert_own', 'post_media_delete_own'],
  'ポリシーは select・insert (投稿者)・delete (投稿者) だけ'
);

-- ===== 権限 (GRANT) =====

select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('anon', 'public.post_media', p)
  ),
  null,
  'anon はデータ操作の権限を持たない'
);
select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('authenticated', 'public.post_media', p)
  ),
  array['DELETE', 'INSERT', 'SELECT'],
  'authenticated は select・insert・delete だけ (update はない)'
);

-- ===== 準備 =====

insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'm1@example.com'),
  ('f2000000-0000-0000-0000-000000000002', 'm2@example.com');

insert into public.posts (id, author_id, body) values
  ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'u1 の投稿'),
  ('a2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'u2 の投稿');

-- ===== ログイン済みの u1 として操作する =====

set local role authenticated;
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "f1000000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;

select lives_ok(
  $$insert into public.post_media (post_id, storage_key, width, height, sort_order) values ('a1000000-0000-0000-0000-000000000001', 'posts/a1/0.jpg', 800, 600, 0)$$,
  '自分の投稿に画像を紐付けられる'
);
select lives_ok(
  $$insert into public.post_media (post_id, storage_key, width, height, sort_order) values ('a1000000-0000-0000-0000-000000000001', 'posts/a1/1.jpg', 800, 600, 1)$$,
  '同じ投稿に 2 枚目も紐付けられる'
);
select is(
  (select count(*)::int from public.post_media where post_id = 'a1000000-0000-0000-0000-000000000001'),
  2,
  '1 つの投稿に複数画像が紐付く'
);
select throws_ok(
  $$insert into public.post_media (post_id, storage_key, width, height, sort_order) values ('a2000000-0000-0000-0000-000000000002', 'posts/a2/0.jpg', 800, 600, 0)$$,
  '42501', null,
  '他人の投稿には画像を紐付けられない'
);
select throws_ok(
  $$insert into public.post_media (post_id, storage_key, width, height, sort_order) values ('a1000000-0000-0000-0000-000000000001', 'posts/a1/dup.jpg', 800, 600, 1)$$,
  '23505', null,
  '同じ投稿で sort_order は重複できない'
);
select throws_ok(
  $$insert into public.post_media (post_id, storage_key, width, height, sort_order) values ('a1000000-0000-0000-0000-000000000001', 'posts/a1/4.jpg', 800, 600, 4)$$,
  '23514', null,
  'sort_order は 0〜3 (最大 4 枚)'
);
select throws_ok(
  $$insert into public.post_media (post_id, storage_key, width, height, sort_order) values ('a1000000-0000-0000-0000-000000000001', 'https://example.com/a.jpg', 800, 600, 2)$$,
  '23514', null,
  'URL は storage_key に入れられない'
);
select throws_ok(
  $$insert into public.post_media (post_id, storage_key, width, height, sort_order) values ('a1000000-0000-0000-0000-000000000001', '', 800, 600, 2)$$,
  '23514', null,
  '空の storage_key は入れられない'
);
select throws_ok(
  $$insert into public.post_media (post_id, storage_key, width, height, sort_order) values ('a1000000-0000-0000-0000-000000000001', 'posts/a1/2.jpg', 0, 600, 2)$$,
  '23514', null,
  'width が 0 以下の画像は入れられない'
);
select throws_ok(
  $$update public.post_media set width = 1$$,
  '42501', null,
  'post_media は更新できない'
);

-- u2 として、閲覧はできるが他人の画像は消せない
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "f2000000-0000-0000-0000-000000000002", "role": "authenticated"}',
    true
  );
end $$;

select is(
  (select count(*)::int from public.post_media),
  2,
  'ログイン済みなら他人の投稿の画像も読める'
);
select lives_ok(
  $$delete from public.post_media where post_id = 'a1000000-0000-0000-0000-000000000001'$$,
  '他人の画像の削除は、エラーにならず 0 行になる'
);
select is(
  (select count(*)::int from public.post_media),
  2,
  '他人の画像は消えていない'
);

-- u1 として自分の画像を消す
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "f1000000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;

select lives_ok(
  $$delete from public.post_media where sort_order = 1$$,
  '自分の画像は削除できる'
);
select is(
  (select count(*)::int from public.post_media),
  1,
  '削除した分だけ減る'
);

reset role;

-- ===== 未ログイン (anon) =====

set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end $$;

select throws_ok(
  $$select count(*) from public.post_media$$,
  '42501', null,
  '未ログインでは読めない'
);
select throws_ok(
  $$insert into public.post_media (post_id, storage_key, width, height) values ('a1000000-0000-0000-0000-000000000001', 'posts/a1/3.jpg', 800, 600)$$,
  '42501', null,
  '未ログインでは紐付けられない'
);
select throws_ok(
  $$delete from public.post_media$$,
  '42501', null,
  '未ログインでは削除できない'
);

reset role;

-- ===== 連鎖削除 =====

select lives_ok(
  $$delete from public.posts where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '投稿を消せる (管理者権限)'
);
select is(
  (select count(*)::int from public.post_media where post_id = 'a1000000-0000-0000-0000-000000000001'),
  0,
  '投稿を消すと、その画像の行も消える'
);

select * from finish();

rollback;

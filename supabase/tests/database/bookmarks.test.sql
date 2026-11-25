-- bookmarks テーブルの構造・権限・RLS を確かめる (XCL-68)。
-- 対象のマイグレーション: 20261125150000_create_bookmarks.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)

begin;

select plan(25);

-- ===== 構造 =====

select has_table('public', 'bookmarks', 'bookmarks テーブルがある');
select columns_are('public', 'bookmarks', array['user_id', 'post_id', 'created_at'], 'bookmarks の列が想定どおり');
select col_is_pk('public', 'bookmarks', array['user_id', 'post_id'], '(user_id, post_id) の複合主キー');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.bookmarks'::regclass),
  'bookmarks の RLS が有効'
);
select policies_are(
  'public', 'bookmarks',
  array['bookmarks_select_own', 'bookmarks_insert_own', 'bookmarks_delete_own'],
  'ポリシーは本人の select・insert・delete だけ'
);

-- ===== 権限 (GRANT) =====

select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('anon', 'public.bookmarks', p)
  ),
  null,
  'anon はデータ操作の権限を持たない'
);
select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('authenticated', 'public.bookmarks', p)
  ),
  array['DELETE', 'INSERT', 'SELECT'],
  'authenticated は select・insert・delete だけ (update はない)'
);

-- ===== 準備 =====

insert into auth.users (id, email) values
  ('d1100000-0000-0000-0000-000000000001', 'b1@example.com'),
  ('d2100000-0000-0000-0000-000000000002', 'b2@example.com');

insert into public.posts (id, author_id, body) values
  ('e2100000-0000-0000-0000-000000000002', 'd2100000-0000-0000-0000-000000000002', 'u2 の投稿');

-- ===== ログイン済みの u1 として操作する =====

set local role authenticated;
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "d1100000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;

select lives_ok(
  $$insert into public.bookmarks (user_id, post_id) values ('d1100000-0000-0000-0000-000000000001', 'e2100000-0000-0000-0000-000000000002')$$,
  '自分のブックマークは作れる'
);
select throws_ok(
  $$insert into public.bookmarks (user_id, post_id) values ('d1100000-0000-0000-0000-000000000001', 'e2100000-0000-0000-0000-000000000002')$$,
  '23505', null,
  '二重ブックマークはできない'
);
select throws_ok(
  $$insert into public.bookmarks (user_id, post_id) values ('d2100000-0000-0000-0000-000000000002', 'e2100000-0000-0000-0000-000000000002')$$,
  '42501', null,
  '他人としてブックマークできない'
);
select is(
  (select count(*)::int from public.bookmarks),
  1,
  '自分のブックマークは読める'
);
select throws_ok(
  $$update public.bookmarks set post_id = post_id$$,
  '42501', null,
  'bookmarks は更新できない'
);

-- ===== 他人 (u2) として操作する =====

do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "d2100000-0000-0000-0000-000000000002", "role": "authenticated"}',
    true
  );
end $$;

select is(
  (select count(*)::int from public.bookmarks),
  0,
  '他人のブックマークは読めない'
);
select is(
  (select count(*)::int from public.bookmarks where user_id = 'd1100000-0000-0000-0000-000000000001'),
  0,
  '他人のブックマークは user_id を指定しても読めない'
);
select lives_ok(
  $$delete from public.bookmarks where user_id = 'd1100000-0000-0000-0000-000000000001'$$,
  '他人のブックマークの削除は、エラーにならず 0 行になる'
);

-- u1 に戻って、消えていないことを確かめる
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "d1100000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;

select is(
  (select count(*)::int from public.bookmarks),
  1,
  '他人に削除されようとしても、ブックマークは残る'
);
select lives_ok(
  $$delete from public.bookmarks where user_id = 'd1100000-0000-0000-0000-000000000001' and post_id = 'e2100000-0000-0000-0000-000000000002'$$,
  '自分のブックマークは解除できる'
);
select is(
  (select count(*)::int from public.bookmarks),
  0,
  '解除するとブックマークが消える'
);

-- 連鎖削除の確認用に作り直す
select lives_ok(
  $$insert into public.bookmarks (user_id, post_id) values ('d1100000-0000-0000-0000-000000000001', 'e2100000-0000-0000-0000-000000000002')$$,
  '自分のブックマークを作り直せる'
);

reset role;

-- ===== 未ログイン (anon) =====

set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end $$;

select throws_ok(
  $$select count(*) from public.bookmarks$$,
  '42501', null,
  '未ログインでは読めない'
);
select throws_ok(
  $$insert into public.bookmarks (user_id, post_id) values ('d1100000-0000-0000-0000-000000000001', 'e2100000-0000-0000-0000-000000000002')$$,
  '42501', null,
  '未ログインではブックマークできない'
);
select throws_ok(
  $$delete from public.bookmarks$$,
  '42501', null,
  '未ログインでは削除できない'
);

reset role;

-- ===== 連鎖削除 =====

select lives_ok(
  $$delete from public.posts where id = 'e2100000-0000-0000-0000-000000000002'$$,
  '投稿を消せる (管理者権限)'
);
select is(
  (select count(*)::int from public.bookmarks where post_id = 'e2100000-0000-0000-0000-000000000002'),
  0,
  '投稿を消すと、そのブックマークも消える'
);

select * from finish();

rollback;

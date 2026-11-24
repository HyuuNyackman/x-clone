-- likes テーブルの構造・権限・RLS・カウンタのトリガーを確かめる (XCL-56)。
-- 対象のマイグレーション: 20261124170000_create_likes.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)

begin;

select plan(32);

-- ===== 構造 =====

select has_table('public', 'likes', 'likes テーブルがある');
select columns_are('public', 'likes', array['user_id', 'post_id', 'created_at'], 'likes の列が想定どおり');
select col_is_pk('public', 'likes', array['user_id', 'post_id'], '(user_id, post_id) の複合主キー');
select has_column('public', 'posts', 'like_count', 'posts にカウンタ列がある');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.likes'::regclass),
  'likes の RLS が有効'
);
select policies_are(
  'public', 'likes',
  array['likes_select_all', 'likes_insert_own', 'likes_delete_own'],
  'ポリシーは select・insert (本人)・delete (本人) だけ'
);
select has_trigger('public', 'likes', 'on_like_changed', 'カウンタ用のトリガーがある');

-- ===== 権限 (GRANT) =====

select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('anon', 'public.likes', p)
  ),
  null,
  'anon はデータ操作の権限を持たない'
);
select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('authenticated', 'public.likes', p)
  ),
  array['DELETE', 'INSERT', 'SELECT'],
  'authenticated は select・insert・delete だけ (update はない)'
);
select is(
  has_function_privilege('authenticated', 'public.update_post_like_count()', 'execute'),
  false,
  'カウンタ更新関数は authenticated から直接呼べない'
);

-- ===== 準備 =====

insert into auth.users (id, email) values
  ('d1000000-0000-0000-0000-000000000001', 'l1@example.com'),
  ('d2000000-0000-0000-0000-000000000002', 'l2@example.com');

insert into public.posts (id, author_id, body) values
  ('e2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'u2 の投稿');

select is(
  (select like_count from public.posts where id = 'e2000000-0000-0000-0000-000000000002'),
  0,
  '新しい投稿のいいね数は 0'
);

-- ===== ログイン済みの u1 として操作する =====

set local role authenticated;
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "d1000000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;

select lives_ok(
  $$insert into public.likes (user_id, post_id) values ('d1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002')$$,
  '自分のいいねは作れる'
);
select is(
  (select like_count from public.posts where id = 'e2000000-0000-0000-0000-000000000002'),
  1,
  'いいねでカウンタが 1 増える'
);
select throws_ok(
  $$insert into public.likes (user_id, post_id) values ('d1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002')$$,
  '23505', null,
  '二重いいねはできない'
);
select is(
  (select like_count from public.posts where id = 'e2000000-0000-0000-0000-000000000002'),
  1,
  '二重いいねを拒否してもカウンタは増えない'
);
select throws_ok(
  $$insert into public.likes (user_id, post_id) values ('d2000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002')$$,
  '42501', null,
  '他人としていいねできない'
);
select is(
  (select count(*)::int from public.likes),
  1,
  'ログイン済みなら likes を読める'
);

-- カウンタを直接いじれない
select throws_ok(
  $$update public.posts set like_count = 100 where id = 'e2000000-0000-0000-0000-000000000002'$$,
  '42501', null,
  'カウンタを直接更新できない'
);
select throws_ok(
  $$insert into public.posts (author_id, body, like_count) values ('d1000000-0000-0000-0000-000000000001', 'x', 100)$$,
  '42501', null,
  'カウンタを偽って投稿を作れない'
);
select lives_ok(
  $$insert into public.posts (author_id, body) values ('d1000000-0000-0000-0000-000000000001', '普通の投稿')$$,
  'カウンタを指定しない投稿は作れる'
);
select throws_ok(
  $$update public.likes set post_id = post_id$$,
  '42501', null,
  'likes は更新できない'
);

-- 他人のいいねは消せない
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "d2000000-0000-0000-0000-000000000002", "role": "authenticated"}',
    true
  );
end $$;
select lives_ok(
  $$delete from public.likes where user_id = 'd1000000-0000-0000-0000-000000000001'$$,
  '他人のいいねの削除は、エラーにならず 0 行になる'
);
select is(
  (select like_count from public.posts where id = 'e2000000-0000-0000-0000-000000000002'),
  1,
  '他人のいいねを消そうとしてもカウンタは減らない'
);

-- u2 もいいねして 2 にする
select lives_ok(
  $$insert into public.likes (user_id, post_id) values ('d2000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002')$$,
  'u2 もいいねできる'
);
select is(
  (select like_count from public.posts where id = 'e2000000-0000-0000-0000-000000000002'),
  2,
  '2 人のいいねでカウンタは 2'
);

-- 自分のいいねを取り消す
select lives_ok(
  $$delete from public.likes where user_id = 'd2000000-0000-0000-0000-000000000002' and post_id = 'e2000000-0000-0000-0000-000000000002'$$,
  '自分のいいねは取り消せる'
);
select is(
  (select like_count from public.posts where id = 'e2000000-0000-0000-0000-000000000002'),
  1,
  '取り消しでカウンタが 1 減る'
);

reset role;

-- ===== 未ログイン (anon) =====

set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end $$;

select throws_ok(
  $$select count(*) from public.likes$$,
  '42501', null,
  '未ログインでは読めない'
);
select throws_ok(
  $$insert into public.likes (user_id, post_id) values ('d1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002')$$,
  '42501', null,
  '未ログインではいいねできない'
);
select throws_ok(
  $$delete from public.likes$$,
  '42501', null,
  '未ログインでは削除できない'
);

reset role;

-- ===== 連鎖削除 =====

select lives_ok(
  $$delete from public.posts where id = 'e2000000-0000-0000-0000-000000000002'$$,
  '投稿を消せる (管理者権限)'
);
select is(
  (select count(*)::int from public.likes where post_id = 'e2000000-0000-0000-0000-000000000002'),
  0,
  '投稿を消すと、そのいいねも消える'
);

select * from finish();

rollback;

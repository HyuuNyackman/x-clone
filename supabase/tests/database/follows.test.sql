-- follows テーブルの構造・権限・RLS・自己フォロー禁止を確かめる (XCL-58)。
-- 対象のマイグレーション: 20261124180000_create_follows.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)

begin;

select plan(23);

-- ===== 構造 =====

select has_table('public', 'follows', 'follows テーブルがある');
select columns_are('public', 'follows', array['follower_id', 'followee_id', 'created_at'], 'follows の列が想定どおり');
select col_is_pk('public', 'follows', array['follower_id', 'followee_id'], '(follower_id, followee_id) の複合主キー');
select has_check('public', 'follows', 'follows に check 制約がある');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.follows'::regclass),
  'follows の RLS が有効'
);
select policies_are(
  'public', 'follows',
  array['follows_select_all', 'follows_insert_own', 'follows_delete_own'],
  'ポリシーは select・insert (本人)・delete (本人) だけ'
);

-- ===== 権限 (GRANT) =====

select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('anon', 'public.follows', p)
  ),
  null,
  'anon はデータ操作の権限を持たない'
);
select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('authenticated', 'public.follows', p)
  ),
  array['DELETE', 'INSERT', 'SELECT'],
  'authenticated は select・insert・delete だけ (update はない)'
);

-- ===== 準備 =====

insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'f1@example.com'),
  ('f2000000-0000-0000-0000-000000000002', 'f2@example.com'),
  ('f3000000-0000-0000-0000-000000000003', 'f3@example.com');

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
  $$insert into public.follows (follower_id, followee_id) values ('f1000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002')$$,
  '自分が follower のフォローは作れる'
);
select throws_ok(
  $$insert into public.follows (follower_id, followee_id) values ('f1000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002')$$,
  '23505', null,
  '二重フォローはできない'
);
select throws_ok(
  $$insert into public.follows (follower_id, followee_id) values ('f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001')$$,
  '23514', null,
  '自分自身はフォローできない'
);
select throws_ok(
  $$insert into public.follows (follower_id, followee_id) values ('f2000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000003')$$,
  '42501', null,
  '他人を follower にしたフォローは作れない'
);
select throws_ok(
  $$update public.follows set followee_id = 'f3000000-0000-0000-0000-000000000003'$$,
  '42501', null,
  'follows は更新できない'
);
select is(
  (select count(*)::int from public.follows),
  1,
  'ログイン済みなら follows を読める'
);

-- u2 は u1 のフォローを消せない
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "f2000000-0000-0000-0000-000000000002", "role": "authenticated"}',
    true
  );
end $$;
select lives_ok(
  $$delete from public.follows where follower_id = 'f1000000-0000-0000-0000-000000000001'$$,
  '他人のフォローの削除は、エラーにならず 0 行になる'
);
select is(
  (select count(*)::int from public.follows),
  1,
  '他人のフォローは消えていない'
);

-- u1 は自分のフォローを解除できる
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "f1000000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;
select lives_ok(
  $$delete from public.follows where follower_id = 'f1000000-0000-0000-0000-000000000001' and followee_id = 'f2000000-0000-0000-0000-000000000002'$$,
  '自分のフォローは解除できる'
);
select is(
  (select count(*)::int from public.follows),
  0,
  '解除したフォローは消えている'
);

reset role;

-- ===== 未ログイン (anon) =====

set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end $$;

select throws_ok(
  $$select count(*) from public.follows$$,
  '42501', null,
  '未ログインでは読めない'
);
select throws_ok(
  $$insert into public.follows (follower_id, followee_id) values ('f1000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002')$$,
  '42501', null,
  '未ログインではフォローできない'
);
select throws_ok(
  $$delete from public.follows$$,
  '42501', null,
  '未ログインでは削除できない'
);

reset role;

-- ===== 連鎖削除 =====

insert into public.follows (follower_id, followee_id) values
  ('f1000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002');

select lives_ok(
  $$delete from auth.users where id = 'f2000000-0000-0000-0000-000000000002'$$,
  'ユーザーを消せる (管理者権限)'
);
select is(
  (select count(*)::int from public.follows),
  0,
  'ユーザーを消すと、そのフォローも消える'
);

select * from finish();

rollback;

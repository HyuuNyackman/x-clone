-- posts テーブルの構造・権限・RLS・制約を確かめる (XCL-53)。
-- 対象のマイグレーション: 20261124150000_create_posts.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)

begin;

select plan(33);

-- ===== 構造 =====

select has_table('public', 'posts', 'posts テーブルがある');

select columns_are(
  'public', 'posts',
  array['id', 'author_id', 'body', 'reply_to', 'quote_of', 'repost_of', 'created_at', 'like_count'],
  'posts の列が想定どおり'
);

select col_is_pk('public', 'posts', 'id', 'id が主キー');
select col_type_is('public', 'posts', 'id', 'uuid', 'id は uuid');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.posts'::regclass),
  'posts の RLS が有効'
);

select policies_are(
  'public', 'posts',
  array['posts_select_all', 'posts_insert_own', 'posts_delete_own'],
  'ポリシーは select・insert (本人)・delete (本人) だけ'
);

select has_index('public', 'posts', 'posts_created_at_id_idx', array['created_at', 'id'], '(created_at, id) のインデックスがある');

-- ===== 権限 (GRANT) =====

select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('anon', 'public.posts', p)
  ),
  null,
  'anon はデータ操作の権限を持たない'
);
select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('authenticated', 'public.posts', p)
  ),
  array['DELETE', 'INSERT', 'SELECT'],
  'authenticated は select・insert・delete だけ (update はない)'
);

-- ===== 準備: ユーザー 2 人 (profiles はトリガーで自動作成される) =====

insert into auth.users (id, email) values
  ('b1000000-0000-0000-0000-000000000001', 'p1@example.com'),
  ('b2000000-0000-0000-0000-000000000002', 'p2@example.com');

insert into public.posts (id, author_id, body) values
  ('c2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'u2 の投稿');

-- ===== ログイン済み (authenticated) のユーザー u1 として操作する =====

set local role authenticated;
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "b1000000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;

select lives_ok(
  $$insert into public.posts (id, author_id, body) values ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'u1 の投稿')$$,
  '自分の投稿は作れる'
);
select throws_ok(
  $$insert into public.posts (author_id, body) values ('b2000000-0000-0000-0000-000000000002', 'なりすまし')$$,
  '42501', null,
  '他人として投稿できない'
);
select lives_ok(
  $$insert into public.posts (author_id, body, reply_to) values ('b1000000-0000-0000-0000-000000000001', 'リプライ', 'c2000000-0000-0000-0000-000000000002')$$,
  '他人の投稿にリプライできる'
);
select lives_ok(
  $$insert into public.posts (author_id, body, quote_of) values ('b1000000-0000-0000-0000-000000000001', '引用', 'c2000000-0000-0000-0000-000000000002')$$,
  '他人の投稿を引用できる'
);
select lives_ok(
  $$insert into public.posts (id, author_id, repost_of) values ('c1000000-0000-0000-0000-0000000000f1', 'b1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002')$$,
  '他人の投稿をリポストできる (本文なし)'
);

select is(
  (select count(*)::int from public.posts),
  5,
  'ログイン済みなら、他人の投稿も読める'
);

-- 制約
select throws_ok(
  $$insert into public.posts (author_id, body) values ('b1000000-0000-0000-0000-000000000001', repeat('a', 281))$$,
  '23514', null,
  '本文は 280 文字まで'
);
select lives_ok(
  $$insert into public.posts (author_id, body) values ('b1000000-0000-0000-0000-000000000001', repeat('あ', 280))$$,
  '本文は 280 文字ちょうどなら入る'
);
select throws_ok(
  $$insert into public.posts (author_id, body) values ('b1000000-0000-0000-0000-000000000001', '   ')$$,
  '23514', null,
  '空白だけの本文は拒否される'
);
select throws_ok(
  $$insert into public.posts (author_id, body, repost_of) values ('b1000000-0000-0000-0000-000000000001', 'x', 'c2000000-0000-0000-0000-000000000002')$$,
  '23514', null,
  'リポストに本文は付けられない'
);
select throws_ok(
  $$insert into public.posts (author_id, body, reply_to, quote_of) values ('b1000000-0000-0000-0000-000000000001', 'x', 'c2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002')$$,
  '23514', null,
  'リプライと引用は同時に指定できない'
);

-- 更新・削除
select throws_ok(
  $$update public.posts set body = '改ざん' where id = 'c1000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  '自分の投稿でも更新できない (編集機能はない)'
);
select lives_ok(
  $$delete from public.posts where id = 'c2000000-0000-0000-0000-000000000002'$$,
  '他人の投稿の削除は、エラーにならず 0 行になる'
);
select lives_ok(
  $$delete from public.posts where id = 'c1000000-0000-0000-0000-000000000001'$$,
  '自分の投稿は削除できる'
);

reset role;

select is(
  (select count(*)::int from public.posts where id = 'c2000000-0000-0000-0000-000000000002'),
  1,
  '他人の投稿は消えていない'
);
select is(
  (select count(*)::int from public.posts where id = 'c1000000-0000-0000-0000-000000000001'),
  0,
  '自分の投稿は消えている'
);
-- ===== 未ログイン (anon) =====

set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end $$;

select throws_ok(
  $$select count(*) from public.posts$$,
  '42501', null,
  '未ログインでは読めない'
);
select throws_ok(
  $$insert into public.posts (author_id, body) values ('b1000000-0000-0000-0000-000000000001', 'x')$$,
  '42501', null,
  '未ログインでは作成できない'
);
select throws_ok(
  $$delete from public.posts where id = 'c2000000-0000-0000-0000-000000000002'$$,
  '42501', null,
  '未ログインでは削除できない'
);

reset role;

-- ===== 連鎖削除 =====

select lives_ok(
  $$delete from public.posts where id = 'c2000000-0000-0000-0000-000000000002'$$,
  '元の投稿を消せる (管理者権限)'
);
select is(
  (select count(*)::int from public.posts where id = 'c1000000-0000-0000-0000-0000000000f1'),
  0,
  '元の投稿を消すと、そのリポストも消える'
);
select is(
  (select count(*)::int from public.posts where body in ('リプライ', '引用') and reply_to is null and quote_of is null),
  2,
  '元の投稿を消しても、リプライと引用は残り、参照だけが外れる'
);
select lives_ok(
  $$delete from auth.users where id = 'b1000000-0000-0000-0000-000000000001'$$,
  'ユーザーを削除できる'
);
select is(
  (select count(*)::int from public.posts where author_id = 'b1000000-0000-0000-0000-000000000001'),
  0,
  'ユーザーを消すと、その投稿も消える'
);

select * from finish();

rollback;

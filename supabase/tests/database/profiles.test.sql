-- profiles テーブルの構造・権限・RLS・サインアップ時の自動作成トリガーを確かめる (XCL-88)。
-- 対象のマイグレーション: 20261124060000_create_profiles.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback するので、DB は汚れない)
--
-- ユーザーを auth.users に直接入れて、ロール (anon / authenticated) と JWT の claims を切り替えて確かめる。
-- テスト用の uuid は、先頭の10桁がそれぞれ違う (初期 handle が user_ + 先頭10桁になり、一意になる)。

begin;

select plan(38);

-- ===== 構造 =====

select has_table('public', 'profiles', 'profiles テーブルがある');

select columns_are(
  'public', 'profiles',
  array['id', 'handle', 'display_name', 'avatar_url', 'bio', 'created_at'],
  'profiles の列が想定どおり'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles の RLS が有効'
);

select policies_are(
  'public', 'profiles',
  array['profiles_select_all', 'profiles_update_own'],
  'ポリシーは select (全員) と update (本人) だけ'
);

select has_trigger('auth', 'users', 'on_auth_user_created', 'auth.users にサインアップ用のトリガーがある');

-- ===== 権限 (GRANT) =====

-- Data API (PostgREST) から使えるデータ操作の権限は、テーブル全体では select だけ。update は列を絞って付けている。
-- truncate / references / trigger は、Data API からは実行できないので、ここでは見ない。
select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('anon', 'public.profiles', p)
  ),
  array['SELECT'],
  'anon が持つデータ操作の権限は select だけ'
);
select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('authenticated', 'public.profiles', p)
  ),
  array['SELECT'],
  'authenticated も、テーブル全体では select だけ (update は列ごと)'
);

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'handle', 'UPDATE'),
  'authenticated は handle を更新できる'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE'),
  'authenticated は id を更新できない'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE'),
  'authenticated は created_at を更新できない'
);
select ok(
  not has_column_privilege('anon', 'public.profiles', 'bio', 'UPDATE'),
  'anon は bio を更新できない'
);

-- トリガー専用の関数を、API から直接呼べない。
select ok(
  not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'),
  'anon は handle_new_user を実行できない'
);
select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
  'authenticated は handle_new_user を実行できない'
);

-- ===== サインアップ時の自動作成トリガー =====

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1000000-0000-0000-0000-000000000001', 'u1@example.com', '{}'),
  ('a2000000-0000-0000-0000-000000000002', 'u2@example.com', '{"name": "Alice"}'),
  ('a3000000-0000-0000-0000-000000000003', 'u3@example.com', '{"name": ""}'),
  ('a4000000-0000-0000-0000-000000000004', 'u4@example.com', json_build_object('name', repeat('あ', 70))::jsonb);

select is(
  (select handle from public.profiles where id = 'a1000000-0000-0000-0000-000000000001'),
  'user_a100000000',
  '初期 handle は user_ + uuid の先頭10桁'
);
select is(
  (select display_name from public.profiles where id = 'a1000000-0000-0000-0000-000000000001'),
  'user_a100000000',
  '名前がなければ、display_name は初期 handle になる'
);
select matches(
  (select handle from public.profiles where id = 'a1000000-0000-0000-0000-000000000001'),
  '^[a-z0-9_]{3,15}$',
  '初期 handle は handle の形式の制約を満たす'
);
select is(
  (select display_name from public.profiles where id = 'a2000000-0000-0000-0000-000000000002'),
  'Alice',
  'メタデータの name が display_name になる'
);
select is(
  (select display_name from public.profiles where id = 'a3000000-0000-0000-0000-000000000003'),
  'user_a300000000',
  'name が空文字なら、display_name は初期 handle になる'
);
select is(
  (select char_length(display_name) from public.profiles where id = 'a4000000-0000-0000-0000-000000000004'),
  50,
  '長すぎる name は50文字に切り詰められる'
);

-- ===== ログイン済み (authenticated) のユーザー u1 として操作する =====

set local role authenticated;
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "a1000000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;

select is(
  (select count(*)::int from public.profiles where id::text like 'a_000000-0000-0000-0000-00000000000_'),
  4,
  'ログイン済みなら、他人のプロフィールも読める'
);

select lives_ok(
  $$update public.profiles set bio = 'こんにちは' where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '自分のプロフィールは更新できる'
);

-- 他人の行は、RLS で対象から外れる (エラーにはならず、0行の更新になる)。結果は後で、権限を戻して確かめる。
select lives_ok(
  $$update public.profiles set bio = 'のっとり' where id = 'a2000000-0000-0000-0000-000000000002'$$,
  '他人のプロフィールの更新は、エラーにならず0行になる'
);

select throws_ok(
  $$update public.profiles set id = 'a9000000-0000-0000-0000-000000000009' where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'id は更新できない'
);
select throws_ok(
  $$update public.profiles set created_at = now() where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'created_at は更新できない'
);
select throws_ok(
  $$insert into public.profiles (id, handle, display_name) values (gen_random_uuid(), 'hacker_1', 'x')$$,
  '42501', null,
  'API からは profiles を作れない (作成はトリガーだけ)'
);
select throws_ok(
  $$delete from public.profiles where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'profiles を削除できない'
);

select throws_ok(
  $$update public.profiles set handle = 'Bad-Handle' where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'handle の形式に合わないと拒否される'
);
select throws_ok(
  $$update public.profiles set handle = 'user_a200000000' where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '23505', null,
  '他人と同じ handle は拒否される'
);
select throws_ok(
  $$update public.profiles set bio = repeat('a', 161) where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'bio は160文字まで'
);
select throws_ok(
  $$update public.profiles set display_name = '' where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '23514', null,
  'display_name は空にできない'
);

-- 権限を戻して、更新の結果を確かめる。
reset role;

select is(
  (select bio from public.profiles where id = 'a1000000-0000-0000-0000-000000000001'),
  'こんにちは',
  '自分の bio は変わっている'
);
select is(
  (select bio from public.profiles where id = 'a2000000-0000-0000-0000-000000000002'),
  '',
  '他人の bio は変わっていない'
);

-- ===== 未ログイン (anon) =====

set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end $$;

select is(
  (select count(*)::int from public.profiles where id::text like 'a_000000-0000-0000-0000-00000000000_'),
  4,
  '未ログインでも、プロフィールは読める'
);
select throws_ok(
  $$update public.profiles set bio = 'x' where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  '未ログインでは更新できない'
);
select throws_ok(
  $$insert into public.profiles (id, handle, display_name) values (gen_random_uuid(), 'hacker_2', 'x')$$,
  '42501', null,
  '未ログインでは作成できない'
);
select throws_ok(
  $$delete from public.profiles where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  '未ログインでは削除できない'
);

reset role;

-- ===== ユーザーを消すと、プロフィールも消える =====

select lives_ok(
  $$delete from auth.users where id = 'a4000000-0000-0000-0000-000000000004'$$,
  'auth.users のユーザーを削除できる'
);
select is(
  (select count(*)::int from public.profiles where id = 'a4000000-0000-0000-0000-000000000004'),
  0,
  'ユーザーを消すと、プロフィールも消える (on delete cascade)'
);

select * from finish();

rollback;

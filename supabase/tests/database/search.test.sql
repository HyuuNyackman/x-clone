-- search_posts / search_users の構造・権限・検索結果を確かめる (XCL-67)。
-- 対象のマイグレーション: 20261125140000_create_search_functions.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)

begin;

select plan(19);

-- ===== 構造・権限 =====

select has_function('public', 'search_posts', array['text', 'timestamp with time zone', 'uuid', 'integer'], 'search_posts がある');
select has_function('public', 'search_users', array['text', 'integer'], 'search_users がある');
select has_index('public', 'posts', 'posts_body_trgm_idx', 'posts.body の trigram インデックスがある');
select has_index('public', 'profiles', 'profiles_handle_trgm_idx', 'profiles.handle の trigram インデックスがある');
select has_index('public', 'profiles', 'profiles_display_name_trgm_idx', 'profiles.display_name の trigram インデックスがある');

select ok(
  has_function_privilege('authenticated', 'public.search_posts(text, timestamptz, uuid, int)', 'EXECUTE'),
  'authenticated は search_posts を実行できる'
);
select ok(
  not has_function_privilege('anon', 'public.search_posts(text, timestamptz, uuid, int)', 'EXECUTE'),
  'anon は search_posts を実行できない'
);
select ok(
  has_function_privilege('authenticated', 'public.search_users(text, int)', 'EXECUTE'),
  'authenticated は search_users を実行できる'
);
select ok(
  not has_function_privilege('anon', 'public.search_users(text, int)', 'EXECUTE'),
  'anon は search_users を実行できない'
);

-- ===== 準備 =====

insert into auth.users (id, email) values
  ('d1000000-0000-0000-0000-000000000001', 's1@example.com'),
  ('d2000000-0000-0000-0000-000000000002', 's2@example.com');

update public.profiles set handle = 'alice_dev', display_name = 'Alice Wonder'
  where id = 'd1000000-0000-0000-0000-000000000001';
update public.profiles set handle = 'bob_smith', display_name = 'ボブ'
  where id = 'd2000000-0000-0000-0000-000000000002';

insert into public.posts (id, author_id, body, created_at) values
  ('e0000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Hello Supabase', '2026-01-01 00:00:01+00'),
  ('e0000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'hello world', '2026-01-01 00:00:02+00'),
  ('e0000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000002', '100% 完了', '2026-01-01 00:00:03+00'),
  ('e0000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', '今日は東京に行く', '2026-01-01 00:00:04+00');

insert into public.posts (id, author_id, repost_of, created_at) values
  ('e0000000-0000-0000-0000-0000000000f1', 'd2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '2026-01-01 00:00:09+00');

-- ===== 未ログイン (anon) =====

set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end $$;

select throws_ok($$select * from public.search_posts('hello')$$, '42501', null, '未ログインでは search_posts を呼べない');
select throws_ok($$select * from public.search_users('alice')$$, '42501', null, '未ログインでは search_users を呼べない');

-- ===== ログイン済み (authenticated) の u1 =====

set local role authenticated;
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "d1000000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;

select is(
  (select count(*) from public.search_posts('HELLO')),
  2::bigint,
  '投稿は大文字小文字を区別せず部分一致で見つかる'
);
select is(
  (select array_agg(id order by created_at desc) from public.search_posts('hello')),
  array['e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001']::uuid[],
  '投稿は新しい順に返る'
);
select is(
  (select pg_typeof(avatar_url)::text from public.search_posts('hello') limit 1),
  'text',
  '投稿の検索結果に avatar_url の列がある'
);
select is(
  (select count(*) from public.search_posts('%')),
  1::bigint,
  'ワイルドカード (%) は文字として検索される'
);
select is(
  (select count(*) from public.search_posts('東京')),
  1::bigint,
  '日本語の部分一致で投稿が見つかる'
);
select is(
  (select count(*) from public.search_posts('   ')),
  0::bigint,
  '空白だけの検索語は何も返さない'
);
select is(
  (select handle from public.search_users('bob')),
  'bob_smith',
  'handle でユーザーが見つかる'
);
select is(
  (select handle from public.search_users('ボ')),
  'bob_smith',
  '表示名 (日本語) でユーザーが見つかる'
);

select * from finish();

rollback;

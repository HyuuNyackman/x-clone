-- get_timeline (タイムライン取得 RPC) の構造・権限・keyset ページネーションを確かめる (XCL-55)。
-- 対象のマイグレーション: 20261124160000_create_get_timeline.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)

begin;

select plan(18);

-- ===== 構造・権限 =====

select has_function('public', 'get_timeline', array['timestamp with time zone', 'uuid', 'integer'], 'get_timeline がある');

select ok(
  has_function_privilege('authenticated', 'public.get_timeline(timestamptz, uuid, int)', 'EXECUTE'),
  'authenticated は get_timeline を実行できる'
);
select ok(
  not has_function_privilege('anon', 'public.get_timeline(timestamptz, uuid, int)', 'EXECUTE'),
  'anon は get_timeline を実行できない'
);

-- ===== 準備: ユーザー 2 人と投稿 =====
-- created_at が同じ投稿を 2 件入れて、id で順序が決まること (重複・欠落がないこと) を確かめる。

insert into auth.users (id, email) values
  ('d1000000-0000-0000-0000-000000000001', 't1@example.com'),
  ('d2000000-0000-0000-0000-000000000002', 't2@example.com');

insert into public.posts (id, author_id, body, created_at) values
  ('e0000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'p1', '2026-01-01 00:00:01+00'),
  ('e0000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'p2', '2026-01-01 00:00:02+00'),
  ('e0000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'p3', '2026-01-01 00:00:03+00'),
  ('e0000000-0000-0000-0000-000000000004', 'd2000000-0000-0000-0000-000000000002', 'p4', '2026-01-01 00:00:03+00'),
  ('e0000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', 'p5', '2026-01-01 00:00:05+00');

insert into public.posts (id, author_id, repost_of, created_at) values
  ('e0000000-0000-0000-0000-0000000000f1', 'd2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '2026-01-01 00:00:09+00');

-- いいね: p2 は u1・u2 の 2 件、p3 は u2 だけ (カウンタはトリガーが更新する)。
insert into public.likes (user_id, post_id) values
  ('d1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002'),
  ('d2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002'),
  ('d2000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003');

-- ===== 未ログイン (anon) =====

set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end $$;

select throws_ok(
  $$select * from public.get_timeline()$$,
  '42501', null,
  '未ログインでは呼べない'
);

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

select lives_ok($$select * from public.get_timeline()$$, 'ログイン済みなら権限エラーにならない');

select is(
  (select array_agg(body order by created_at desc, id desc) from public.get_timeline(null, null, 50)),
  array['p5', 'p4', 'p3', 'p2', 'p1'],
  '新着順 (created_at, id の降順) で返り、リポストは含まれない'
);

select is(
  (select handle from public.get_timeline(null, null, 50) where body = 'p2'),
  (select handle from public.profiles where id = 'd2000000-0000-0000-0000-000000000002'),
  '投稿者の handle が付く'
);
select is(
  (select display_name from public.get_timeline(null, null, 50) where body = 'p2'),
  (select display_name from public.profiles where id = 'd2000000-0000-0000-0000-000000000002'),
  '投稿者の表示名が付く'
);

-- ページ 1 (2 件) → ページ 2 → ページ 3 と、カーソルで続きを取る。
select is(
  (select array_agg(body order by created_at desc, id desc) from public.get_timeline(null, null, 2)),
  array['p5', 'p4'],
  'ページ 1: 先頭 2 件'
);
select is(
  (select array_agg(body order by created_at desc, id desc)
     from public.get_timeline('2026-01-01 00:00:03+00', 'e0000000-0000-0000-0000-000000000004', 2)),
  array['p3', 'p2'],
  'ページ 2: p4 のカーソルの続き。created_at が同じ p3 が欠落しない'
);
select is(
  (select array_agg(body order by created_at desc, id desc)
     from public.get_timeline('2026-01-01 00:00:02+00', 'e0000000-0000-0000-0000-000000000002', 2)),
  array['p1'],
  'ページ 3: 最後の 1 件'
);
select is(
  (select count(*)::int from public.get_timeline('2026-01-01 00:00:01+00', 'e0000000-0000-0000-0000-000000000001', 2)),
  0,
  '最後のカーソルの続きは空'
);

-- 3 ページ分をつなげると、重複も欠落もない。
select is(
  (
    select array_agg(body order by created_at desc, id desc) from (
      select * from public.get_timeline(null, null, 2)
      union all
      select * from public.get_timeline('2026-01-01 00:00:03+00', 'e0000000-0000-0000-0000-000000000004', 2)
      union all
      select * from public.get_timeline('2026-01-01 00:00:02+00', 'e0000000-0000-0000-0000-000000000002', 2)
    ) t
  ),
  array['p5', 'p4', 'p3', 'p2', 'p1'],
  'ページをつなぐと、重複も欠落もない'
);

select is(
  (select count(*)::int from public.get_timeline(null, null, 0)),
  1,
  'p_limit が 0 以下でも、最低 1 件は返す'
);
select is(
  (select count(*)::int from public.get_timeline()),
  5,
  '引数なしなら、先頭から既定の件数 (20 件まで) を返す'
);

-- いいね数と「自分がいいね済みか」(u1 から見る)
select is(
  (select like_count from public.get_timeline(null, null, 50) where body = 'p2'),
  2,
  'like_count を返す'
);
select is(
  (select liked_by_me from public.get_timeline(null, null, 50) where body = 'p2'),
  true,
  '自分がいいねした投稿は liked_by_me が true'
);
select is(
  (select array_agg(body order by body) from public.get_timeline(null, null, 50) where liked_by_me),
  array['p2'],
  '他人だけがいいねした投稿 (p3) や、いいねのない投稿は liked_by_me が false'
);

reset role;

select * from finish();

rollback;

-- リプライ数カウンタ (posts.reply_count) と get_timeline の reply_count を確かめる (XCL-57)。
-- 対象のマイグレーション: 20261125100000_add_reply_count.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)

begin;

select plan(14);

-- ===== 構造・権限 =====

select has_column('public', 'posts', 'reply_count', 'posts にリプライ数の列がある');
select has_trigger('public', 'posts', 'on_reply_changed', 'カウンタ用のトリガーがある');
select is(
  has_function_privilege('authenticated', 'public.update_post_reply_count()', 'execute'),
  false,
  'カウンタ更新関数は authenticated から直接呼べない'
);
select ok(
  has_function_privilege('authenticated', 'public.get_timeline(timestamptz, uuid, int)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_timeline(timestamptz, uuid, int)', 'EXECUTE'),
  'get_timeline は authenticated だけが実行できる'
);

-- ===== 準備 =====

insert into auth.users (id, email) values
  ('d1000000-0000-0000-0000-000000000001', 'r1@example.com'),
  ('d2000000-0000-0000-0000-000000000002', 'r2@example.com');

insert into public.posts (id, author_id, body) values
  ('e3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', '元の投稿');

select is(
  (select reply_count from public.posts where id = 'e3000000-0000-0000-0000-000000000001'),
  0,
  '新しい投稿のリプライ数は 0'
);

-- ===== u2 としてリプライする =====

set local role authenticated;
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "d2000000-0000-0000-0000-000000000002", "role": "authenticated"}',
    true
  );
end $$;

select lives_ok(
  $$insert into public.posts (id, author_id, body, reply_to) values ('e3000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', '返信 1', 'e3000000-0000-0000-0000-000000000001')$$,
  '他人の投稿にリプライできる'
);
select lives_ok(
  $$insert into public.posts (id, author_id, body, reply_to) values ('e3000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000002', '返信 2', 'e3000000-0000-0000-0000-000000000001')$$,
  '2 件目のリプライも作れる'
);
select is(
  (select reply_count from public.posts where id = 'e3000000-0000-0000-0000-000000000001'),
  2,
  'リプライでカウンタが増える'
);
select is(
  (select reply_count from public.get_timeline(null, null, 50) where id = 'e3000000-0000-0000-0000-000000000001'),
  2,
  'get_timeline が reply_count を返す'
);

-- カウンタを直接いじれない
select throws_ok(
  $$update public.posts set reply_count = 100 where id = 'e3000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'カウンタを直接更新できない'
);
select throws_ok(
  $$insert into public.posts (author_id, body, reply_count) values ('d2000000-0000-0000-0000-000000000002', 'x', 100)$$,
  '42501', null,
  'カウンタを偽って投稿を作れない'
);

-- リプライを消すとカウンタが減る
select lives_ok(
  $$delete from public.posts where id = 'e3000000-0000-0000-0000-000000000002'$$,
  '自分のリプライを消せる'
);
select is(
  (select reply_count from public.posts where id = 'e3000000-0000-0000-0000-000000000001'),
  1,
  'リプライを消すとカウンタが減る'
);

-- 元の投稿を消しても、リプライは残る (reply_to が null になる)
reset role;
delete from public.posts where id = 'e3000000-0000-0000-0000-000000000001';
select is(
  (select reply_to from public.posts where id = 'e3000000-0000-0000-0000-000000000003'),
  null,
  '元の投稿を消しても、リプライは残る'
);

select * from finish();

rollback;

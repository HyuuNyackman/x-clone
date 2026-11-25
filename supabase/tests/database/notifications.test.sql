-- notifications テーブルの構造・権限・RLS・トリガーを確かめる (XCL-60)。
-- 対象のマイグレーション: 20261125110000_create_notifications.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)

begin;

select plan(36);

-- ===== 構造 =====

select has_table('public', 'notifications', 'notifications テーブルがある');
select columns_are(
  'public', 'notifications',
  array['id', 'user_id', 'type', 'actor_id', 'post_id', 'read_at', 'created_at'],
  'notifications の列が想定どおり'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
  'notifications の RLS が有効'
);
select policies_are(
  'public', 'notifications',
  array['notifications_select_own', 'notifications_update_own'],
  'ポリシーは select・update (本人) だけ。insert のポリシーはない'
);
select has_trigger('public', 'likes', 'on_like_notify', 'いいね用のトリガーがある');
select has_trigger('public', 'posts', 'on_reply_notify', 'リプライ用のトリガーがある');
select has_trigger('public', 'follows', 'on_follow_notify', 'フォロー用のトリガーがある');

-- ===== 権限 (GRANT) =====

select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p
    where has_table_privilege('anon', 'public.notifications', p)
  ),
  null,
  'anon はデータ操作の権限を持たない'
);
select is(
  (
    select array_agg(p order by p)
    from unnest(array['SELECT', 'INSERT', 'DELETE']) as p
    where has_table_privilege('authenticated', 'public.notifications', p)
  ),
  array['SELECT'],
  'authenticated はテーブル全体では select だけ'
);
select is(
  (
    select array_agg(c order by c)
    from unnest(array['type', 'actor_id', 'read_at']) as c
    where has_column_privilege('authenticated', 'public.notifications', c, 'UPDATE')
  ),
  array['read_at'],
  'authenticated が更新できる列は read_at だけ'
);
select is(
  has_function_privilege('authenticated', 'public.notify_on_like()', 'execute')
    or has_function_privilege('authenticated', 'public.notify_on_reply()', 'execute')
    or has_function_privilege('authenticated', 'public.notify_on_follow()', 'execute'),
  false,
  '通知用のトリガー関数は authenticated から直接呼べない'
);

-- ===== 準備 =====

insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'n1@example.com'),
  ('f2000000-0000-0000-0000-000000000002', 'n2@example.com');

insert into public.posts (id, author_id, body) values
  ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'u1 の投稿'),
  ('a2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'u2 の投稿');

-- ===== u2 として操作する (他ユーザーの操作で u1 宛の通知が作られる) =====

set local role authenticated;
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "f2000000-0000-0000-0000-000000000002", "role": "authenticated"}',
    true
  );
end $$;

select lives_ok(
  $$insert into public.likes (user_id, post_id) values ('f2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001')$$,
  'u2 が u1 の投稿にいいねできる'
);
select lives_ok(
  $$insert into public.posts (id, author_id, body, reply_to) values ('a3000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000002', 'リプライ', 'a1000000-0000-0000-0000-000000000001')$$,
  'u2 が u1 の投稿にリプライできる'
);
select lives_ok(
  $$insert into public.follows (follower_id, followee_id) values ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001')$$,
  'u2 が u1 をフォローできる'
);

-- 自分自身への操作では通知を作らない
select lives_ok(
  $$insert into public.likes (user_id, post_id) values ('f2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002')$$,
  'u2 が自分の投稿にいいねできる'
);
select lives_ok(
  $$insert into public.posts (author_id, body, reply_to) values ('f2000000-0000-0000-0000-000000000002', '自分へのリプライ', 'a2000000-0000-0000-0000-000000000002')$$,
  'u2 が自分の投稿にリプライできる'
);

-- クライアントから直接作れない
select throws_ok(
  $$insert into public.notifications (user_id, type, actor_id) values ('f1000000-0000-0000-0000-000000000001', 'follow', 'f2000000-0000-0000-0000-000000000002')$$,
  '42501', null,
  'クライアントから通知を直接 insert できない'
);

-- u2 には何も届いていない (自分宛の通知は 0 件)
select is(
  (select count(*)::int from public.notifications),
  0,
  'u2 宛の通知はない (自分への操作では作られない)'
);

reset role;

-- ===== 管理者権限で、作られた通知を確かめる =====

select is(
  (select count(*)::int from public.notifications),
  3,
  '通知は 3 件だけ (いいね・リプライ・フォロー。自分宛は作られない)'
);
select is(
  (select count(*)::int from public.notifications
   where user_id = 'f1000000-0000-0000-0000-000000000001' and actor_id = 'f2000000-0000-0000-0000-000000000002'
     and type = 'like' and post_id = 'a1000000-0000-0000-0000-000000000001' and read_at is null),
  1,
  'いいねの通知が u1 宛に作られる'
);
select is(
  (select count(*)::int from public.notifications
   where user_id = 'f1000000-0000-0000-0000-000000000001' and type = 'reply'
     and post_id = 'a3000000-0000-0000-0000-000000000003'),
  1,
  'リプライの通知が u1 宛に作られる (post_id はリプライの投稿)'
);
select is(
  (select count(*)::int from public.notifications
   where user_id = 'f1000000-0000-0000-0000-000000000001' and type = 'follow' and post_id is null),
  1,
  'フォローの通知が u1 宛に作られる'
);

-- ===== u1 として操作する =====

set local role authenticated;
do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "f1000000-0000-0000-0000-000000000001", "role": "authenticated"}',
    true
  );
end $$;

select is(
  (select count(*)::int from public.notifications),
  3,
  'u1 は自分宛の通知を読める'
);
select lives_ok(
  $$update public.notifications set read_at = now() where type = 'follow'$$,
  '自分宛の通知を既読にできる'
);
select is(
  (select count(*)::int from public.notifications where read_at is not null),
  1,
  '既読になっている'
);
select throws_ok(
  $$update public.notifications set type = 'like' where type = 'follow'$$,
  '42501', null,
  'read_at 以外の列は更新できない'
);
select throws_ok(
  $$delete from public.notifications$$,
  '42501', null,
  '通知を削除できない'
);

-- ===== u2 (他人) として操作する =====

do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub": "f2000000-0000-0000-0000-000000000002", "role": "authenticated"}',
    true
  );
end $$;

select is(
  (select count(*)::int from public.notifications),
  0,
  '他人宛の通知は読めない'
);
select lives_ok(
  $$update public.notifications set read_at = null$$,
  '他人宛の通知の更新は、エラーにならず 0 行になる'
);

reset role;

select is(
  (select count(*)::int from public.notifications where read_at is not null),
  1,
  '他人の更新で既読状態は変わらない'
);

-- ===== 未ログイン (anon) =====

set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end $$;

select throws_ok(
  $$select count(*) from public.notifications$$,
  '42501', null,
  '未ログインでは読めない'
);

reset role;

-- ===== 取り消し・連鎖削除 =====

delete from public.likes where user_id = 'f2000000-0000-0000-0000-000000000002' and post_id = 'a1000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.notifications where type = 'like'),
  0,
  'いいねを取り消すと通知も消える'
);
delete from public.follows where follower_id = 'f2000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.notifications where type = 'follow'),
  0,
  'フォローを外すと通知も消える'
);
delete from public.posts where id = 'a3000000-0000-0000-0000-000000000003';
select is(
  (select count(*)::int from public.notifications where type = 'reply'),
  0,
  'リプライを消すと通知も消える'
);

-- 再度作ってプロフィール削除の連鎖を確かめる
insert into public.follows (follower_id, followee_id) values ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.notifications where type = 'follow'),
  1,
  '再フォローで通知がまた作られる'
);
delete from auth.users where id = 'f2000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.notifications),
  0,
  '操作した人のアカウントを消すと通知も消える'
);

select * from finish();

rollback;

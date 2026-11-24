-- 画像用バケットと storage.objects のポリシーを確かめる (XCL-63)。
-- 対象のマイグレーション: 20261124200000_create_storage_buckets.sql
-- 実行: supabase test db (トランザクションの中で動き、最後に rollback する)
-- ファイルサイズと MIME の拒否は Storage API の層で行うので、ここでは設定値を確かめる。

begin;

select plan(14);

-- ===== バケットの設定 =====

select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'post-media' $$,
  $$ values (true, 5242880::bigint, array['image/jpeg', 'image/png', 'image/webp']) $$,
  'post-media は公開、5MiB 上限、jpeg/png/webp だけ'
);
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars' $$,
  $$ values (true, 2097152::bigint, array['image/jpeg', 'image/png', 'image/webp']) $$,
  'avatars は公開、2MiB 上限、jpeg/png/webp だけ'
);

-- ===== 準備 =====

insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 's1@example.com'),
  ('f2000000-0000-0000-0000-000000000002', 's2@example.com');

-- u2 の既存ファイル (postgres 権限で作る)
insert into storage.objects (bucket_id, name, owner_id)
values ('post-media', 'f2000000-0000-0000-0000-000000000002/b.jpg', 'f2000000-0000-0000-0000-000000000002');

-- ===== ログイン済みの u1 として操作する =====

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('post-media', 'f1000000-0000-0000-0000-000000000001/a.jpg', 'f1000000-0000-0000-0000-000000000001') $$,
  '自分のフォルダに post-media へアップロードできる'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('post-media', 'f2000000-0000-0000-0000-000000000002/a.jpg') $$,
  '42501', null,
  '他人のフォルダには書き込めない'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('post-media', 'a.jpg') $$,
  '42501', null,
  'フォルダなしのパスには書き込めない'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('post-media', 'f1000000-0000-0000-0000-000000000001/x/a.jpg') $$,
  '42501', null,
  '自分のフォルダでも 2 階層以上は書き込めない'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('other-bucket', 'f1000000-0000-0000-0000-000000000001/a.jpg') $$,
  '42501', null,
  '対象外のバケットには書き込めない'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', 'f1000000-0000-0000-0000-000000000001/me.png', 'f1000000-0000-0000-0000-000000000001') $$,
  '自分のフォルダに avatars へアップロードできる'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', 'f2000000-0000-0000-0000-000000000002/me.png') $$,
  '42501', null,
  'avatars でも他人のフォルダには書き込めない'
);

-- 削除: ポリシーに合わない行は RLS で見えず、0 行の削除になる
select is(
  (with d as (delete from storage.objects
     where bucket_id = 'post-media' and name = 'f2000000-0000-0000-0000-000000000002/b.jpg' returning 1)
   select count(*)::int from d),
  0,
  '他人のファイルは削除できない'
);
select is(
  (with d as (delete from storage.objects
     where bucket_id = 'post-media' and name = 'f1000000-0000-0000-0000-000000000001/a.jpg' returning 1)
   select count(*)::int from d),
  1,
  '自分のファイルは削除できる'
);

-- ===== 未ログイン (anon) =====

reset role;
set local role anon;

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('post-media', 'f1000000-0000-0000-0000-000000000001/anon.jpg') $$,
  '42501', null,
  '未ログインではアップロードできない'
);
select is(
  (with d as (delete from storage.objects
     where bucket_id = 'post-media' and name = 'f2000000-0000-0000-0000-000000000002/b.jpg' returning 1)
   select count(*)::int from d),
  0,
  '未ログインでは削除できない'
);

reset role;
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and cmd = 'UPDATE'),
  0,
  'storage.objects に update ポリシーはない (上書きできない)'
);

select * from finish();
rollback;

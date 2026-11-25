-- 画像用の Storage バケットと storage.objects の RLS ポリシー (XCL-63)。
-- 保存パスは `{ユーザーID}/{ファイル名}`。自分のフォルダにだけアップロード・削除できる。
-- 読み取りは公開バケットの URL で行うので、select ポリシーは作らない (一覧の取得を許さない)。
-- update ポリシーも作らない。上書き (upsert) はできず、差し替えは削除して作り直す。
--
-- CI のローカル Supabase は storage を起動しない (-x storage) ので、storage スキーマがない。
-- その場合はこのマイグレーションを何もせずに通す。ホスティング版には必ずある。

do $$
declare
  b text;
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise notice 'storage スキーマがないので、バケットとポリシーの作成を飛ばす';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('post-media', 'post-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
    ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

  -- 直下のフォルダが自分のユーザー ID で、その下にファイルが 1 階層だけあるパスに限る。
  foreach b in array array['post-media', 'avatars'] loop
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (
           bucket_id = %L
           and (storage.foldername(name))[1] = (select auth.uid())::text
           and array_length(storage.foldername(name), 1) = 1
         )',
      replace(b, '-', '_') || '_objects_insert_own_folder', b
    );
    -- delete は対象の行を探すために select のポリシーも通る。自分のフォルダだけ見えるようにする (他人のファイルは一覧にも出ない)。
    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (
           bucket_id = %L
           and (storage.foldername(name))[1] = (select auth.uid())::text
         )',
      replace(b, '-', '_') || '_objects_select_own_folder', b
    );
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (
           bucket_id = %L
           and (storage.foldername(name))[1] = (select auth.uid())::text
         )',
      replace(b, '-', '_') || '_objects_delete_own_folder', b
    );
  end loop;
end
$$;

-- 画像用の Storage バケットと storage.objects の RLS ポリシー (XCL-63)。
-- 保存パスは `{ユーザーID}/{ファイル名}`。自分のフォルダにだけアップロード・削除できる。
-- 読み取りは公開バケットの URL で行うので、select ポリシーは作らない (一覧の取得を許さない)。
-- update ポリシーも作らない。上書き (upsert) はできず、差し替えは削除して作り直す。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-media', 'post-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 直下のフォルダが自分のユーザー ID で、その下にファイルが 1 階層だけあるパスに限る。
create policy "post_media_objects_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

create policy "post_media_objects_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_objects_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );

create policy "avatars_objects_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

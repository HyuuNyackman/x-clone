import { supabase } from '@/lib/supabase';
import type { MediaBucket } from '@/features/media/media-url';
import type { ProcessedImage } from '@/features/media/image-processing';

// 保存するキー。Storage の RLS は `{ユーザーID}/{ファイル名}` の形だけ許すので、その形にする。
export function newMediaKey(userId: string): string {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${userId}/${id}.jpg`;
}

// 圧縮済みの画像を、自分のフォルダへ直接アップロードして、キーを返す。
export async function uploadImage(
  bucket: MediaBucket,
  userId: string,
  image: ProcessedImage,
): Promise<string> {
  const key = newMediaKey(userId);
  const body = await (await fetch(image.uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`画像をアップロードできませんでした: ${error.message}`);
  return key;
}

// 失敗したときの後始末。失敗しても握りつぶす (孤児ファイルは残るが、投稿の失敗を優先して伝える)。
export async function removeImages(bucket: MediaBucket, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await supabase.storage.from(bucket).remove(keys);
}

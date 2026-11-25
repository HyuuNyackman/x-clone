// 表示 URL はキーからアプリ側で組み立てる (保存先を変えやすくするため)。DB にはキーだけを持つ。
export type MediaBucket = 'post-media' | 'avatars';

// 保存先のベース URL。保存先を R2 などに移すときは EXPO_PUBLIC_MEDIA_BASE_URL を変える。
function baseUrl(): string {
  const custom = process.env.EXPO_PUBLIC_MEDIA_BASE_URL;
  if (custom) return custom.replace(/\/+$/, '');
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  return `${supabaseUrl}/storage/v1/object/public`;
}

export function mediaUrl(bucket: MediaBucket, key: string): string {
  return `${baseUrl()}/${bucket}/${key.replace(/^\/+/, '')}`;
}

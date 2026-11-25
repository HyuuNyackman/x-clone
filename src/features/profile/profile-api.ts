import type { ProfileValues } from '@/features/profile/schemas';
import type { ProcessedImage } from '@/features/media/image-processing';
import { removeImages, uploadImage } from '@/features/media/media-api';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
};

// 特定の入力欄のエラーとして表示したいエラー。
export class ProfileFieldError extends Error {
  field: keyof ProfileValues;

  constructor(field: keyof ProfileValues, message: string) {
    super(message);
    this.name = 'ProfileFieldError';
    this.field = field;
  }
}

const COLUMNS = 'id, handle, display_name, avatar_url, bio';

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
  };
}

// サインアップ時にトリガーが付ける初期 handle (user_ + uuid の先頭10桁)。supabase の handle_new_user と揃える。
export function initialHandleFor(userId: string): string {
  return `user_${userId.replace(/-/g, '').slice(0, 10)}`;
}

// 初期 handle のままなら、まだ初回設定が済んでいない。
export function needsProfileSetup(profile: Profile): boolean {
  return profile.handle === initialHandleFor(profile.id);
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).single();
  if (error) throw new Error(`プロフィールを読み込めませんでした: ${error.message}`);
  return toProfile(data);
}

export async function updateProfile(userId: string, values: ProfileValues): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ handle: values.handle, display_name: values.displayName, bio: values.bio })
    .eq('id', userId)
    .select(COLUMNS)
    .single();
  if (error) {
    // 23505: unique 違反 (profiles_handle_key)
    if (error.code === '23505') {
      throw new ProfileFieldError('handle', 'このハンドルは既に使われています');
    }
    throw new Error(`プロフィールを保存できませんでした: ${error.message}`);
  }
  return toProfile(data);
}

// handle からプロフィールを読む。無ければ null。
export async function fetchProfileByHandle(handle: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw new Error(`プロフィールを読み込めませんでした: ${error.message}`);
  return data ? toProfile(data) : null;
}

export type FollowCounts = { following: number; followers: number };

// フォロー数 (その人がフォローしている数) とフォロワー数 (その人をフォローしている数)。
export async function fetchFollowCounts(userId: string): Promise<FollowCounts> {
  const [following, followers] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
  ]);
  const error = following.error ?? followers.error;
  if (error) throw new Error(`フォロー数を読み込めませんでした: ${error.message}`);
  return { following: following.count ?? 0, followers: followers.count ?? 0 };
}

// アバターを差し替える。新しいキーを保存し、古い画像は消す (消せなくても差し替え自体は成功とする)。
export async function updateAvatar(userId: string, image: ProcessedImage): Promise<Profile> {
  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .single();
  const key = await uploadImage('avatars', userId, image);
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: key })
    .eq('id', userId)
    .select(COLUMNS)
    .single();
  if (error) {
    await removeImages('avatars', [key]);
    throw new Error(`アイコンを保存できませんでした: ${error.message}`);
  }
  const old = (current as { avatar_url: string | null } | null)?.avatar_url;
  if (old) await removeImages('avatars', [old]).catch(() => undefined);
  return toProfile(data);
}

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import {
  fetchFollowCounts,
  fetchProfile,
  fetchProfileByHandle,
  updateAvatar,
  updateProfile,
} from '@/features/profile/profile-api';
import type { ProcessedImage } from '@/features/media/image-processing';
import type { ProfileValues } from '@/features/profile/schemas';

const profileKey = (userId: string | undefined) => ['profile', userId] as const;

export function useProfile() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: profileKey(userId),
    queryFn: () => fetchProfile(userId!),
    enabled: userId !== undefined,
  });
}

// 保存して、キャッシュのプロフィールを更新する関数を返す。失敗時は例外を投げる。
export function useSaveProfile() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();
  return async (values: ProfileValues) => {
    if (!userId) throw new Error('ログインしていません');
    const profile = await updateProfile(userId, values);
    queryClient.setQueryData(profileKey(userId), profile);
  };
}

// アバターを差し替えて、キャッシュのプロフィールを更新する関数を返す。失敗時は例外を投げる。
export function useSaveAvatar() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();
  return async (image: ProcessedImage) => {
    if (!userId) throw new Error('ログインしていません');
    const profile = await updateAvatar(userId, image);
    queryClient.setQueryData(profileKey(userId), profile);
  };
}

// handle で引くプロフィール (他ユーザーのプロフィール画面用)。無ければ data は null。
export function useProfileByHandle(handle: string) {
  return useQuery({
    queryKey: ['profile', 'handle', handle] as const,
    queryFn: () => fetchProfileByHandle(handle),
  });
}

export const followCountsKey = (userId: string | undefined) =>
  ['follows', 'counts', userId] as const;

// フォロー数・フォロワー数。
export function useFollowCounts(userId: string | undefined) {
  return useQuery({
    queryKey: followCountsKey(userId),
    queryFn: () => fetchFollowCounts(userId as string),
    enabled: Boolean(userId),
  });
}

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import { fetchProfile, updateProfile } from '@/features/profile/profile-api';
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

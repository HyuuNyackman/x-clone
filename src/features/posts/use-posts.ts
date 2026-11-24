import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import { createPost, deletePost, fetchTimeline, type Post } from '@/features/posts/posts-api';
import { useProfile } from '@/features/profile/use-profile';

export const timelineKey = ['posts', 'timeline'] as const;

export function useTimeline() {
  return useQuery({ queryKey: timelineKey, queryFn: fetchTimeline });
}

// 投稿する。送信中から、仮の投稿を先頭に出す (楽観的更新)。失敗したら元に戻す。
export function useCreatePost() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useProfile().data;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => {
      if (!userId) throw new Error('ログインしていません');
      return createPost(userId, body);
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: timelineKey });
      const previous = queryClient.getQueryData<Post[]>(timelineKey);
      if (userId) {
        const optimistic: Post = {
          id: `optimistic-${Date.now()}`,
          authorId: userId,
          body,
          createdAt: new Date().toISOString(),
          author: { handle: profile?.handle ?? '', displayName: profile?.displayName ?? '' },
        };
        queryClient.setQueryData<Post[]>(timelineKey, (old) => [optimistic, ...(old ?? [])]);
      }
      return { previous };
    },
    onError: (_error, _body, context) => {
      queryClient.setQueryData(timelineKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: timelineKey }),
  });
}

// 自分の投稿を消す。押した瞬間にタイムラインから外し、失敗したら戻す。
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePost,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: timelineKey });
      const previous = queryClient.getQueryData<Post[]>(timelineKey);
      queryClient.setQueryData<Post[]>(timelineKey, (old) =>
        old?.filter((post) => post.id !== postId),
      );
      return { previous };
    },
    onError: (_error, _postId, context) => {
      queryClient.setQueryData(timelineKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: timelineKey }),
  });
}

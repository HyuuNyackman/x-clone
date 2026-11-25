import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import {
  createPost,
  deletePost,
  fetchPost,
  fetchReplies,
  fetchTimelinePage,
  likePost,
  unlikePost,
  type Post,
  type TimelineCursor,
  type TimelinePage,
} from '@/features/posts/posts-api';
import { useProfile } from '@/features/profile/use-profile';

export const timelineKey = ['posts', 'timeline'] as const;

type TimelineData = InfiniteData<TimelinePage, TimelineCursor | null>;

export function useTimeline() {
  return useInfiniteQuery({
    queryKey: timelineKey,
    queryFn: ({ pageParam }) => fetchTimelinePage(pageParam),
    initialPageParam: null as TimelineCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

// 全ページの投稿を 1 本にする。同じ id は 1 回だけ出す。
export function flattenTimeline(data: { pages: TimelinePage[] } | undefined): Post[] {
  const seen = new Set<string>();
  const posts: Post[] = [];
  for (const page of data?.pages ?? []) {
    for (const post of page.posts) {
      if (!seen.has(post.id)) {
        seen.add(post.id);
        posts.push(post);
      }
    }
  }
  return posts;
}

function mapFirstPage(data: TimelineData | undefined, fn: (posts: Post[]) => Post[]) {
  if (!data || data.pages.length === 0) return data;
  const [first, ...rest] = data.pages;
  return { ...data, pages: [{ ...first, posts: fn(first.posts) }, ...rest] };
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
      const previous = queryClient.getQueryData<TimelineData>(timelineKey);
      if (userId) {
        const optimistic: Post = {
          id: `optimistic-${Date.now()}`,
          authorId: userId,
          body,
          createdAt: new Date().toISOString(),
          replyCount: 0,
          likeCount: 0,
          likedByMe: false,
          author: { handle: profile?.handle ?? '', displayName: profile?.displayName ?? '' },
        };
        queryClient.setQueryData<TimelineData>(timelineKey, (old) =>
          mapFirstPage(old, (posts) => [optimistic, ...posts]),
        );
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
      const previous = queryClient.getQueryData<TimelineData>(timelineKey);
      queryClient.setQueryData<TimelineData>(
        timelineKey,
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.filter((post) => post.id !== postId),
            })),
          },
      );
      return { previous };
    },
    onError: (_error, _postId, context) => {
      queryClient.setQueryData(timelineKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: timelineKey }),
  });
}

// いいねの表示を 1 つの投稿に反映する (カウンタは liked に合わせて ±1、0 未満にはしない)。
export function applyLike(post: Post, liked: boolean): Post {
  if (post.likedByMe === liked) return post;
  return { ...post, likedByMe: liked, likeCount: Math.max(post.likeCount + (liked ? 1 : -1), 0) };
}

export const postKey = (postId: string) => ['posts', 'detail', postId] as const;
export const repliesKey = (postId: string) => ['posts', 'replies', postId] as const;

// 投稿詳細の元投稿。
export function usePost(postId: string) {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({ queryKey: postKey(postId), queryFn: () => fetchPost(postId, userId) });
}

// 投稿詳細のリプライ一覧 (古い順)。
export function useReplies(postId: string) {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({ queryKey: repliesKey(postId), queryFn: () => fetchReplies(postId, userId) });
}

// リプライする。送信中から、一覧の末尾に仮のリプライを出し、元投稿のカウンタも増やす。失敗したら戻す。
export function useReplyToPost(postId: string) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useProfile().data;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => {
      if (!userId) throw new Error('ログインしていません');
      return createPost(userId, body, postId);
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: repliesKey(postId) });
      await queryClient.cancelQueries({ queryKey: postKey(postId) });
      const previousReplies = queryClient.getQueryData<Post[]>(repliesKey(postId));
      const previousPost = queryClient.getQueryData<Post | null>(postKey(postId));
      if (userId) {
        const optimistic: Post = {
          id: `optimistic-${Date.now()}`,
          authorId: userId,
          body,
          createdAt: new Date().toISOString(),
          replyCount: 0,
          likeCount: 0,
          likedByMe: false,
          author: { handle: profile?.handle ?? '', displayName: profile?.displayName ?? '' },
        };
        queryClient.setQueryData<Post[]>(repliesKey(postId), (old) =>
          old ? [...old, optimistic] : old,
        );
        queryClient.setQueryData<Post | null>(postKey(postId), (old) =>
          old ? { ...old, replyCount: old.replyCount + 1 } : old,
        );
      }
      return { previousReplies, previousPost };
    },
    onError: (_error, _body, context) => {
      queryClient.setQueryData(repliesKey(postId), context?.previousReplies);
      queryClient.setQueryData(postKey(postId), context?.previousPost);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: repliesKey(postId) }),
        queryClient.invalidateQueries({ queryKey: postKey(postId) }),
        // タイムラインのリプライ数も更新する。
        queryClient.invalidateQueries({ queryKey: timelineKey }),
      ]),
  });
}

type LikeVariables = { postId: string; liked: boolean };

// いいね・取り消し。押した瞬間にタイムライン・詳細・リプライ一覧の表示を変え、失敗したら戻す (楽観的更新)。
// 操作は scope で直列にし、連打しても順番どおりに 1 件ずつ送る。二重いいねは DB の主キーでも防ぐ。
export function useToggleLike() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();

  return useMutation({
    // いいね操作は 1 件ずつ順番に送る (連打しても、押した順に反映される)。
    scope: { id: 'like' },
    mutationFn: ({ postId, liked }: LikeVariables) => {
      if (!userId) throw new Error('ログインしていません');
      return liked ? likePost(userId, postId) : unlikePost(userId, postId);
    },
    onMutate: async ({ postId, liked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: timelineKey }),
        queryClient.cancelQueries({ queryKey: ['posts', 'detail', postId] }),
        queryClient.cancelQueries({ queryKey: ['posts', 'replies'] }),
      ]);
      const previousTimeline = queryClient.getQueryData<TimelineData>(timelineKey);
      const previousDetails = queryClient.getQueriesData<Post | null>({
        queryKey: ['posts', 'detail'],
      });
      const previousReplies = queryClient.getQueriesData<Post[]>({
        queryKey: ['posts', 'replies'],
      });

      const update = (post: Post) => (post.id === postId ? applyLike(post, liked) : post);
      queryClient.setQueryData<TimelineData>(
        timelineKey,
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({ ...page, posts: page.posts.map(update) })),
          },
      );
      queryClient.setQueriesData<Post | null>({ queryKey: ['posts', 'detail'] }, (old) =>
        old ? update(old) : old,
      );
      queryClient.setQueriesData<Post[]>({ queryKey: ['posts', 'replies'] }, (old) =>
        old?.map(update),
      );
      return { previousTimeline, previousDetails, previousReplies };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(timelineKey, context.previousTimeline);
      for (const [key, data] of [...context.previousDetails, ...context.previousReplies]) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: (_data, _error, { postId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: timelineKey }),
        queryClient.invalidateQueries({ queryKey: postKey(postId) }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'replies'] }),
      ]),
  });
}

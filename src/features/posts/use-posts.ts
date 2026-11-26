import { useMemo } from 'react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/auth-store';
import {
  addBookmark,
  createPost,
  deletePost,
  fetchBookmarkedIds,
  fetchBookmarkedPosts,
  fetchFollowingIds,
  fetchPost,
  fetchRepliesPage,
  fetchTimelinePage,
  fetchUserPostsPage,
  followUser,
  likePost,
  removeBookmark,
  unfollowUser,
  unlikePost,
  type Post,
  type TimelineCursor,
  type TimelinePage,
} from '@/features/posts/posts-api';
import type { ProcessedImage } from '@/features/media/image-processing';
import { useProfile } from '@/features/profile/use-profile';

// 「おすすめ」(全体) のタイムライン。['posts', 'timeline'] は「フォロー中」も含む前方一致のキーでもある。
export const timelineKey = ['posts', 'timeline'] as const;
export const followingTimelineKey = ['posts', 'timeline', 'following'] as const;

type TimelineData = InfiniteData<TimelinePage, TimelineCursor | null>;

export type TimelineTab = 'recommended' | 'following';

export function useTimeline(tab: TimelineTab = 'recommended') {
  const followingOnly = tab === 'following';
  return useInfiniteQuery({
    queryKey: followingOnly ? followingTimelineKey : timelineKey,
    queryFn: ({ pageParam }) => fetchTimelinePage(pageParam, undefined, followingOnly),
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

export type CreatePostVariables = { body: string; images?: ProcessedImage[] };

// 投稿する。送信中から、仮の投稿を先頭に出す (楽観的更新)。失敗したら元に戻す。
export function useCreatePost() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useProfile().data;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, images }: CreatePostVariables) => {
      if (!userId) throw new Error('ログインしていません');
      return createPost(userId, body, undefined, images);
    },
    onMutate: async ({ body }) => {
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
          author: {
            handle: profile?.handle ?? '',
            displayName: profile?.displayName ?? '',
            avatarUrl: profile?.avatarUrl ?? null,
          },
          media: [],
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
      const previous = queryClient.getQueriesData<TimelineData>({ queryKey: timelineKey });
      queryClient.setQueriesData<TimelineData>(
        { queryKey: timelineKey },
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
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
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
  return useInfiniteQuery({
    queryKey: repliesKey(postId),
    queryFn: ({ pageParam }) => fetchRepliesPage(postId, pageParam, userId),
    initialPageParam: null as TimelineCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
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
      const previousReplies = queryClient.getQueryData<TimelineData>(repliesKey(postId));
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
          author: {
            handle: profile?.handle ?? '',
            displayName: profile?.displayName ?? '',
            avatarUrl: profile?.avatarUrl ?? null,
          },
          media: [],
        };
        // 末尾まで読み込み済みのときだけ、最後のページに足す (途中までなら、続きを読んだときに出る)。
        queryClient.setQueryData<TimelineData>(repliesKey(postId), (old) => {
          if (!old || old.pages.length === 0) return old;
          const last = old.pages[old.pages.length - 1];
          if (last.nextCursor) return old;
          return {
            ...old,
            pages: [...old.pages.slice(0, -1), { ...last, posts: [...last.posts, optimistic] }],
          };
        });
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

export const userPostsKey = (authorId: string | undefined) => ['posts', 'user', authorId] as const;

// ある人の投稿一覧 (プロフィール画面用)。
export function useUserPosts(authorId: string | undefined) {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useInfiniteQuery({
    queryKey: userPostsKey(authorId),
    queryFn: ({ pageParam }) => fetchUserPostsPage(authorId as string, pageParam, userId),
    initialPageParam: null as TimelineCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(authorId),
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
        queryClient.cancelQueries({ queryKey: ['posts', 'user'] }),
      ]);
      const previousTimelines = queryClient.getQueriesData<TimelineData>({ queryKey: timelineKey });
      const previousDetails = queryClient.getQueriesData<Post | null>({
        queryKey: ['posts', 'detail'],
      });
      const previousReplies = queryClient.getQueriesData<TimelineData>({
        queryKey: ['posts', 'replies'],
      });

      const update = (post: Post) => (post.id === postId ? applyLike(post, liked) : post);
      queryClient.setQueriesData<TimelineData>(
        { queryKey: timelineKey },
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({ ...page, posts: page.posts.map(update) })),
          },
      );
      queryClient.setQueriesData<Post | null>({ queryKey: ['posts', 'detail'] }, (old) =>
        old ? update(old) : old,
      );
      const updatePages = (old: TimelineData | undefined) =>
        old && {
          ...old,
          pages: old.pages.map((page) => ({ ...page, posts: page.posts.map(update) })),
        };
      queryClient.setQueriesData<TimelineData>({ queryKey: ['posts', 'replies'] }, updatePages);
      const previousUserPosts = queryClient.getQueriesData<TimelineData>({
        queryKey: ['posts', 'user'],
      });
      queryClient.setQueriesData<TimelineData>({ queryKey: ['posts', 'user'] }, updatePages);
      return { previousTimelines, previousDetails, previousReplies, previousUserPosts };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      for (const [key, data] of [
        ...context.previousTimelines,
        ...context.previousDetails,
        ...context.previousReplies,
        ...context.previousUserPosts,
      ]) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: (_data, _error, { postId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: timelineKey }),
        queryClient.invalidateQueries({ queryKey: postKey(postId) }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'replies'] }),
        queryClient.invalidateQueries({ queryKey: ['posts', 'user'] }),
      ]),
  });
}

// 前方一致で、自分のフォロー先の問い合わせ全部を指す。
export const followingIdsKey = (userId: string | undefined) =>
  ['follows', 'following', userId] as const;

// 表示中の投稿の投稿者のうち、自分がフォローしている人の id。ログインしていなければ取らない。
// 投稿者が増えて問い合わせが変わる間は、前の結果を出し続ける (ボタンの表示がちらつかないように)。
export function useFollowingIds(authorIds: string[]) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const ids = useMemo(() => [...new Set(authorIds)].sort(), [authorIds]);
  return useQuery({
    queryKey: [...followingIdsKey(userId), ids] as const,
    queryFn: () => fetchFollowingIds(userId as string, ids),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });
}

// 表示中の投稿の投稿者 id (重複なし)。
export function authorIdsOf(posts: Post[]): string[] {
  return [...new Set(posts.map((post) => post.authorId))];
}

// フォローのつけ外しを反映した id 一覧 (重複なし)。
export function applyFollow(ids: string[], targetId: string, follow: boolean): string[] {
  const without = ids.filter((id) => id !== targetId);
  return follow ? [...without, targetId] : without;
}

// タイムラインから、ある投稿者の投稿を外す。
export function removeAuthorPosts<T extends { pages: TimelinePage[] }>(
  data: T | undefined,
  authorId: string,
): T | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      posts: page.posts.filter((post) => post.authorId !== authorId),
    })),
  };
}

type FollowVariables = { targetId: string; follow: boolean };

// フォロー・解除。押した瞬間に表示を変え、失敗したら戻す (楽観的更新)。操作は scope で直列にする。
// 完了後は「フォロー中」タブも取り直す。
export function useToggleFollow() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();
  const key = followingIdsKey(userId);

  return useMutation({
    scope: { id: 'follow' },
    mutationFn: ({ targetId, follow }: FollowVariables) => {
      if (!userId) throw new Error('ログインしていません');
      return follow ? followUser(userId, targetId) : unfollowUser(userId, targetId);
    },
    onMutate: async ({ targetId, follow }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: key }),
        queryClient.cancelQueries({ queryKey: followingTimelineKey }),
      ]);
      const previous = queryClient.getQueriesData<string[]>({ queryKey: key });
      const previousTimeline = queryClient.getQueriesData<TimelineData>({
        queryKey: followingTimelineKey,
      });
      queryClient.setQueriesData<string[]>({ queryKey: key }, (old) =>
        applyFollow(old ?? [], targetId, follow),
      );
      // 解除したら、「フォロー中」タブからその人の投稿を外す。
      if (!follow) {
        queryClient.setQueriesData<TimelineData>({ queryKey: followingTimelineKey }, (old) =>
          removeAuthorPosts(old, targetId),
        );
      }
      return { previous, previousTimeline };
    },
    onError: (_error, _variables, context) => {
      for (const [k, data] of [
        ...(context?.previous ?? []),
        ...(context?.previousTimeline ?? []),
      ]) {
        queryClient.setQueryData(k, data);
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: followingTimelineKey }),
        // プロフィール画面のフォロー数・フォロワー数も取り直す。
        queryClient.invalidateQueries({ queryKey: ['follows', 'counts'] }),
      ]),
  });
}

export const bookmarkedIdsKey = (userId: string | undefined) =>
  ['bookmarks', 'ids', userId] as const;
export const bookmarksKey = (userId: string | undefined) => ['bookmarks', 'list', userId] as const;

// 自分がブックマークした投稿の id。ログインしていなければ取らない。
export function useBookmarkedIds() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: bookmarkedIdsKey(userId),
    queryFn: () => fetchBookmarkedIds(userId as string),
    enabled: Boolean(userId),
  });
}

// 自分のブックマーク一覧 (新しい順)。
export function useBookmarks() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: bookmarksKey(userId),
    queryFn: () => fetchBookmarkedPosts(userId as string),
    enabled: Boolean(userId),
  });
}

// ブックマークのつけ外しを反映した id 一覧 (重複なし)。
export function applyBookmark(ids: string[], postId: string, bookmarked: boolean): string[] {
  const without = ids.filter((id) => id !== postId);
  return bookmarked ? [...without, postId] : without;
}

type BookmarkVariables = { postId: string; bookmarked: boolean };

// ブックマーク・解除。押した瞬間に表示を変え、失敗したら戻す (楽観的更新)。操作は scope で直列にする。
export function useToggleBookmark() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();
  const key = bookmarkedIdsKey(userId);

  return useMutation({
    scope: { id: 'bookmark' },
    mutationFn: ({ postId, bookmarked }: BookmarkVariables) => {
      if (!userId) throw new Error('ログインしていません');
      return bookmarked ? addBookmark(userId, postId) : removeBookmark(userId, postId);
    },
    onMutate: async ({ postId, bookmarked }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key);
      queryClient.setQueryData<string[]>(key, (old) =>
        applyBookmark(old ?? [], postId, bookmarked),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: bookmarksKey(userId) }),
      ]),
  });
}

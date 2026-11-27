import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import BookmarksScreen from '@/app/(tabs)/bookmarks';
import type { Post } from '@/features/posts/posts-api';
import { useBookmarks, useToggleBookmark } from '@/features/posts/use-posts';

jest.mock('@/features/posts/use-posts', () => ({
  flattenTimeline: jest.requireActual('@/features/posts/use-posts').flattenTimeline,
  useBookmarks: jest.fn(),
  useToggleBookmark: jest.fn(),
}));
// flash-list は ESM のままで jest が読めないので、同じ props を受ける FlatList に差し替える。
jest.mock('@shopify/flash-list', () => ({
  FlashList: jest.requireActual('react-native').FlatList,
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const routes = {
  bookmarks: BookmarksScreen,
  'post/[id]': () => null,
  'user/[handle]': () => null,
};

const post = (n: number): Post => ({
  id: `p${n}`,
  authorId: 'u1',
  body: `投稿 ${n}`,
  createdAt: '2026-11-25T00:00:00Z',
  replyCount: 0,
  likeCount: 0,
  likedByMe: false,
  author: { handle: 'alice', displayName: 'Alice', avatarUrl: null },
  media: [],
});

const fetchNextPage = jest.fn();
const toggle = jest.fn();

function setup(overrides: Record<string, unknown> = {}) {
  jest.mocked(useBookmarks).mockReturnValue({
    data: {
      pages: [
        { posts: [post(1), post(2)], nextCursor: { createdAt: 'c', postId: 'p2' } },
        { posts: [post(3)], nextCursor: null },
      ],
      pageParams: [null, { createdAt: 'c', postId: 'p2' }],
    },
    isPending: false,
    isError: false,
    isRefetching: false,
    isFetchingNextPage: false,
    hasNextPage: true,
    fetchNextPage,
    refetch: jest.fn(),
    ...overrides,
  } as never);
  jest.mocked(useToggleBookmark).mockReturnValue({ mutate: toggle, isError: false } as never);
}

beforeEach(() => jest.clearAllMocks());

describe('ブックマーク画面', () => {
  it('すべてのページの投稿を順に出す', async () => {
    setup();
    await renderRouter(routes, { initialUrl: '/bookmarks' });
    expect(screen.getByText('投稿 1')).toBeTruthy();
    expect(screen.getByText('投稿 2')).toBeTruthy();
    expect(screen.getByText('投稿 3')).toBeTruthy();
  });

  it('末尾に達すると次のページを読む', async () => {
    setup();
    await renderRouter(routes, { initialUrl: '/bookmarks' });
    fireEvent(screen.getByTestId('bookmarks-list'), 'onEndReached');
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['続きがない', { hasNextPage: false }],
    ['次のページを読み込み中', { isFetchingNextPage: true }],
  ])('%sときは、末尾に達しても次のページを読まない', async (_label, overrides) => {
    setup(overrides);
    await renderRouter(routes, { initialUrl: '/bookmarks' });
    fireEvent(screen.getByTestId('bookmarks-list'), 'onEndReached');
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('次のページの読み込み中は、末尾に読み込み中を出す', async () => {
    setup({ isFetchingNextPage: true });
    await renderRouter(routes, { initialUrl: '/bookmarks' });
    expect(screen.getByText('読み込み中…')).toBeTruthy();
  });

  it('最初の読み込み中の表示', async () => {
    setup({ data: undefined, isPending: true, hasNextPage: false });
    await renderRouter(routes, { initialUrl: '/bookmarks' });
    expect(screen.getByText('読み込み中…')).toBeTruthy();
  });

  it('読み込みに失敗すると、エラーを出す', async () => {
    setup({ isError: true, error: new Error('ブックマークを読み込めませんでした: boom') });
    await renderRouter(routes, { initialUrl: '/bookmarks' });
    expect(screen.getByText('ブックマークを読み込めませんでした: boom')).toBeTruthy();
  });

  it('解除すると、解除の mutation を送る', async () => {
    setup();
    await renderRouter(routes, { initialUrl: '/bookmarks' });
    fireEvent.press(screen.getAllByLabelText('ブックマークを解除')[0]);
    expect(toggle).toHaveBeenCalledWith({ postId: 'p1', bookmarked: false });
  });
});

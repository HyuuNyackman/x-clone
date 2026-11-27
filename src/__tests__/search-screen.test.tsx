import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import SearchScreen from '@/app/(tabs)/search';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Post } from '@/features/posts/posts-api';
import {
  useBookmarkedIds,
  useDeletePost,
  useToggleBookmark,
  useToggleLike,
} from '@/features/posts/use-posts';
import { useSearchPosts, useSearchUsers } from '@/features/search/use-search';

jest.mock('@/features/posts/use-posts', () => ({
  flattenTimeline: jest.requireActual('@/features/posts/use-posts').flattenTimeline,
  useBookmarkedIds: jest.fn(),
  useDeletePost: jest.fn(),
  useToggleBookmark: jest.fn(),
  useToggleLike: jest.fn(),
}));
jest.mock('@/features/search/use-search', () => ({
  ...jest.requireActual('@/features/search/use-search'),
  // デバウンスを待たずに、入力をそのまま使う。
  useDebouncedValue: (value: string) => value,
  useSearchPosts: jest.fn(),
  useSearchUsers: jest.fn(),
}));
// FlashList は jest で変換されない ESM なので、FlatList で代える。
jest.mock('@shopify/flash-list', () => ({
  FlashList: jest.requireActual('react-native').FlatList,
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/auth/auth-store', () => ({ useAuthStore: jest.fn() }));

const toggleBookmark = jest.fn();
const routes = { search: SearchScreen, 'post/[id]': () => null, 'user/[handle]': () => null };

const post = (id: string, body: string): Post => ({
  id,
  authorId: 'u1',
  body,
  createdAt: '2026-11-25T00:00:00Z',
  replyCount: 0,
  likeCount: 0,
  likedByMe: false,
  author: { handle: 'alice', displayName: 'Alice', avatarUrl: null },
  media: [],
});

function signIn(userId: string | undefined) {
  jest
    .mocked(useAuthStore)
    .mockImplementation(((selector: (s: unknown) => unknown) =>
      selector({ session: userId ? { user: { id: userId } } : null })) as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  signIn('me');
  jest.mocked(useSearchPosts).mockReturnValue({
    data: {
      pages: [{ posts: [post('p1', '猫の話'), post('p2', '猫の写真')], nextCursor: null }],
      pageParams: [null],
    },
    isPending: false,
    isError: false,
  } as never);
  jest
    .mocked(useSearchUsers)
    .mockReturnValue({ data: [], isPending: false, isError: false } as never);
  jest.mocked(useToggleLike).mockReturnValue({ mutate: jest.fn(), isError: false } as never);
  jest.mocked(useDeletePost).mockReturnValue({ mutate: jest.fn() } as never);
  jest.mocked(useBookmarkedIds).mockReturnValue({ data: ['p1'] } as never);
  jest
    .mocked(useToggleBookmark)
    .mockReturnValue({ mutate: toggleBookmark, isError: false } as never);
});

async function search(text: string) {
  await renderRouter(routes, { initialUrl: '/search' });
  await fireEvent.changeText(screen.getByLabelText('検索キーワード'), text);
}

describe('検索画面', () => {
  it('投稿のタブで、投稿にブックマークのボタンが出る', async () => {
    await search('猫');
    expect(await screen.findByText('猫の話')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ブックマークを解除' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'ブックマーク' }));
    expect(toggleBookmark).toHaveBeenCalledWith({ postId: 'p2', bookmarked: true });
  });

  it('未ログインでは、ブックマークのボタンを出さない', async () => {
    signIn(undefined);
    await search('猫');
    expect(await screen.findByText('猫の話')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'ブックマーク' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ブックマークを解除' })).toBeNull();
  });
});

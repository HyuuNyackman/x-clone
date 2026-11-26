import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import UserProfileScreen from '@/app/user/[handle]';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Post } from '@/features/posts/posts-api';
import {
  useFollowingIds,
  useToggleFollow,
  useToggleLike,
  useUserPosts,
} from '@/features/posts/use-posts';
import { useFollowCounts, useProfileByHandle } from '@/features/profile/use-profile';

jest.mock('@/features/posts/use-posts', () => ({
  flattenTimeline: jest.requireActual('@/features/posts/use-posts').flattenTimeline,
  useFollowingIds: jest.fn(),
  useToggleFollow: jest.fn(),
  useToggleLike: jest.fn(),
  useUserPosts: jest.fn(),
}));
jest.mock('@/features/profile/use-profile', () => ({
  useProfileByHandle: jest.fn(),
  useFollowCounts: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/auth/auth-store', () => ({ useAuthStore: jest.fn() }));

const ME = 'a1000000-0000-0000-0000-000000000001';
const BOB = 'b2000000-0000-0000-0000-000000000002';
const toggleFollow = jest.fn();
const routes = {
  'user/[handle]': UserProfileScreen,
  profile: () => null,
  home: () => null,
  'post/[id]': () => null,
};

const bob = { id: BOB, handle: 'bob', displayName: 'Bob', avatarUrl: null, bio: 'ボブです' };
const post: Post = {
  id: 'p1',
  authorId: BOB,
  body: 'ボブの投稿',
  createdAt: '2026-11-25T00:00:00Z',
  replyCount: 0,
  likeCount: 0,
  likedByMe: false,
  author: { handle: 'bob', displayName: 'Bob' },
  media: [],
};

function setup({ profile = bob as typeof bob | null, following = [] as string[] } = {}) {
  jest.mocked(useProfileByHandle).mockReturnValue({ data: profile, isPending: false } as never);
  jest.mocked(useFollowCounts).mockReturnValue({ data: { following: 3, followers: 5 } } as never);
  jest.mocked(useUserPosts).mockReturnValue({
    data: { pages: [{ posts: [post], nextCursor: null }], pageParams: [null] },
    isPending: false,
  } as never);
  jest.mocked(useFollowingIds).mockReturnValue({ data: following } as never);
  jest.mocked(useToggleFollow).mockReturnValue({ mutate: toggleFollow } as never);
  jest.mocked(useToggleLike).mockReturnValue({ mutate: jest.fn() } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(useAuthStore)
    .mockImplementation(((selector: (s: unknown) => unknown) =>
      selector({ session: { user: { id: ME } } })) as never);
});

describe('プロフィール画面', () => {
  it('プロフィール・フォロー数・フォロワー数・投稿を出す', async () => {
    setup();
    await renderRouter(routes, { initialUrl: '/user/bob' });
    expect(useProfileByHandle).toHaveBeenCalledWith('bob');
    expect(screen.getAllByText('@bob').length).toBeGreaterThan(0);
    expect(screen.getByText('ボブです')).toBeTruthy();
    expect(screen.getByLabelText('フォロー数')).toHaveTextContent('3 フォロー中');
    expect(screen.getByLabelText('フォロワー数')).toHaveTextContent('5 フォロワー');
    expect(screen.getByText('ボブの投稿')).toBeTruthy();
  });

  it('他人のプロフィールでは、フォローを押すとフォロー操作が呼ばれる', async () => {
    setup();
    await renderRouter(routes, { initialUrl: '/user/bob' });
    expect(screen.queryByRole('button', { name: 'プロフィールを編集' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'フォロー' }));
    expect(toggleFollow).toHaveBeenCalledWith({ targetId: BOB, follow: true });
  });

  it('フォロー中なら、押すと解除が呼ばれる', async () => {
    setup({ following: [BOB] });
    await renderRouter(routes, { initialUrl: '/user/bob' });
    await fireEvent.press(screen.getByRole('button', { name: 'フォロー中' }));
    expect(toggleFollow).toHaveBeenCalledWith({ targetId: BOB, follow: false });
  });

  it('自分の handle を開くと、プロフィールのタブに移る', async () => {
    setup({ profile: { ...bob, id: ME, handle: 'me' } });
    await renderRouter(routes, { initialUrl: '/user/me' });
    expect(screen).toHavePathname('/profile');
    expect(screen.queryByRole('button', { name: 'フォロー' })).toBeNull();
  });

  it('ユーザーが無ければ、見つからないと出す', async () => {
    setup({ profile: null });
    await renderRouter(routes, { initialUrl: '/user/nobody' });
    expect(screen.getByText('ユーザーが見つかりません')).toBeTruthy();
  });
});

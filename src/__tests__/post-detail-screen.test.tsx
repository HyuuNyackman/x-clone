import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import PostDetailScreen from '@/app/post/[id]';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Post } from '@/features/posts/posts-api';
import {
  useBookmarkedIds,
  usePost,
  useReplies,
  useReplyToPost,
  useToggleBookmark,
  useToggleLike,
} from '@/features/posts/use-posts';

jest.mock('@/features/posts/use-posts', () => ({
  flattenTimeline: jest.requireActual('@/features/posts/use-posts').flattenTimeline,
  usePost: jest.fn(),
  useReplies: jest.fn(),
  useReplyToPost: jest.fn(),
  useToggleLike: jest.fn(),
  useBookmarkedIds: jest.fn(),
  useToggleBookmark: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/auth/auth-store', () => ({ useAuthStore: jest.fn() }));

const mutateAsync = jest.fn();
const toggleBookmark = jest.fn();

function signIn(userId: string | undefined) {
  jest
    .mocked(useAuthStore)
    .mockImplementation(((selector: (s: unknown) => unknown) =>
      selector({ session: userId ? { user: { id: userId } } : null })) as never);
}
const routes = { 'post/[id]': PostDetailScreen, home: () => null };

const post = (id: string, body: string, replyCount = 0): Post => ({
  id,
  authorId: 'u1',
  body,
  createdAt: '2026-11-25T00:00:00Z',
  replyCount,
  likeCount: 0,
  likedByMe: false,
  author: { handle: 'alice', displayName: 'Alice', avatarUrl: null },
  media: [],
});

const pages = (posts: Post[]) => ({ pages: [{ posts, nextCursor: null }], pageParams: [null] });

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(usePost)
    .mockReturnValue({ data: post('p1', '元の投稿', 1), isPending: false } as never);
  jest
    .mocked(useReplies)
    .mockReturnValue({ data: pages([post('r1', '最初の返信')]), isPending: false } as never);
  jest.mocked(useToggleLike).mockReturnValue({ mutate: jest.fn() } as never);
  jest.mocked(useReplyToPost).mockReturnValue({ mutateAsync, isPending: false } as never);
  jest.mocked(useBookmarkedIds).mockReturnValue({ data: ['p1'] } as never);
  jest
    .mocked(useToggleBookmark)
    .mockReturnValue({ mutate: toggleBookmark, isError: false } as never);
  signIn('me');
});

describe('投稿詳細画面', () => {
  it('元の投稿とリプライ、リプライ数を出す', async () => {
    await renderRouter(routes, { initialUrl: '/post/p1' });
    expect(screen.getByText('元の投稿')).toBeTruthy();
    expect(screen.getByText('最初の返信')).toBeTruthy();
    expect(screen.getByText('返信 1')).toBeTruthy();
    expect(usePost).toHaveBeenCalledWith('p1');
  });

  it('リプライが無ければ、その旨を出す', async () => {
    jest.mocked(useReplies).mockReturnValue({ data: pages([]), isPending: false } as never);
    await renderRouter(routes, { initialUrl: '/post/p1' });
    expect(screen.getByText('まだリプライがありません')).toBeTruthy();
  });

  it('投稿が無ければ、見つからないと出す', async () => {
    jest.mocked(usePost).mockReturnValue({ data: null, isPending: false } as never);
    await renderRouter(routes, { initialUrl: '/post/p1' });
    expect(screen.getByText('投稿が見つかりません')).toBeTruthy();
  });

  it('本文が空のあいだは、返信できない', async () => {
    await renderRouter(routes, { initialUrl: '/post/p1' });
    await fireEvent.press(screen.getByRole('button', { name: '返信する' }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('280文字を超えると、返信できない', async () => {
    await renderRouter(routes, { initialUrl: '/post/p1' });
    await fireEvent.changeText(screen.getByLabelText('返信'), 'a'.repeat(281));
    expect(screen.getByLabelText('返信の残り文字数')).toHaveTextContent('-1');
    await fireEvent.press(screen.getByRole('button', { name: '返信する' }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('本文を入れて返信すると、その本文で呼ばれ、入力が空になる', async () => {
    mutateAsync.mockResolvedValue(undefined);
    await renderRouter(routes, { initialUrl: '/post/p1' });
    await fireEvent.changeText(screen.getByLabelText('返信'), 'ありがとう');
    await fireEvent.press(screen.getByRole('button', { name: '返信する' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('ありがとう'));
    await waitFor(() => expect(screen.getByLabelText('返信').props.value).toBe(''));
  });

  it('返信に失敗すると、エラーが出る', async () => {
    mutateAsync.mockRejectedValue(new Error('投稿できませんでした: boom'));
    await renderRouter(routes, { initialUrl: '/post/p1' });
    await fireEvent.changeText(screen.getByLabelText('返信'), 'x');
    await fireEvent.press(screen.getByRole('button', { name: '返信する' }));
    expect(await screen.findByText('投稿できませんでした: boom')).toBeTruthy();
  });

  it('ブックマーク済みの投稿は済みの状態で出て、押すと解除が呼ばれる', async () => {
    await renderRouter(routes, { initialUrl: '/post/p1' });
    const button = screen.getByRole('button', { name: 'ブックマークを解除' });
    expect(button).toBeSelected();
    await fireEvent.press(button);
    expect(toggleBookmark).toHaveBeenCalledWith({ postId: 'p1', bookmarked: false });
  });

  it('未ブックマークのリプライのボタンを押すと、追加が呼ばれる', async () => {
    await renderRouter(routes, { initialUrl: '/post/p1' });
    const button = screen.getByRole('button', { name: 'ブックマーク' });
    expect(button).not.toBeSelected();
    await fireEvent.press(button);
    expect(toggleBookmark).toHaveBeenCalledWith({ postId: 'r1', bookmarked: true });
  });

  it('未ログインでは、ブックマークのボタンを出さない', async () => {
    signIn(undefined);
    await renderRouter(routes, { initialUrl: '/post/p1' });
    expect(screen.queryByRole('button', { name: 'ブックマーク' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ブックマークを解除' })).toBeNull();
  });
});

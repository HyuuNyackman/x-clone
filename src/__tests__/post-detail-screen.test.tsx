import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import PostDetailScreen from '@/app/post/[id]';
import type { Post } from '@/features/posts/posts-api';
import { usePost, useReplies, useReplyToPost } from '@/features/posts/use-posts';

jest.mock('@/features/posts/use-posts', () => ({
  usePost: jest.fn(),
  useReplies: jest.fn(),
  useReplyToPost: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const mutateAsync = jest.fn();
const routes = { 'post/[id]': PostDetailScreen, home: () => null };

const post = (id: string, body: string, replyCount = 0): Post => ({
  id,
  authorId: 'u1',
  body,
  createdAt: '2026-11-25T00:00:00Z',
  replyCount,
  author: { handle: 'alice', displayName: 'Alice' },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(usePost)
    .mockReturnValue({ data: post('p1', '元の投稿', 1), isPending: false } as never);
  jest
    .mocked(useReplies)
    .mockReturnValue({ data: [post('r1', '最初の返信')], isPending: false } as never);
  jest.mocked(useReplyToPost).mockReturnValue({ mutateAsync, isPending: false } as never);
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
    jest.mocked(useReplies).mockReturnValue({ data: [], isPending: false } as never);
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
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { PostCard } from '@/features/posts/post-card';
import type { Post } from '@/features/posts/posts-api';

const post = (over: Partial<Post> = {}): Post => ({
  id: 'p1',
  authorId: 'u1',
  body: '本文',
  createdAt: '2026-11-25T00:00:00Z',
  replyCount: 0,
  likeCount: 3,
  likedByMe: false,
  author: { handle: 'alice', displayName: 'Alice', avatarUrl: null },
  media: [],
  ...over,
});

describe('PostCard のアバター', () => {
  it('アバターがあれば画像を、無ければ表示名の頭文字を出す', async () => {
    await render(
      <PostCard
        post={post({ author: { handle: 'alice', displayName: 'Alice', avatarUrl: 'u1/a.jpg' } })}
        canDelete={false}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Aliceのアイコン')).toBeTruthy();
    await render(<PostCard post={post()} canDelete={false} onDelete={jest.fn()} />);
    expect(screen.getByText('A')).toBeTruthy();
  });
});

describe('PostCard のいいねボタン', () => {
  it('いいね数を出し、押すと「いいねする」で呼ぶ', async () => {
    const onToggleLike = jest.fn();
    await render(
      <PostCard post={post()} canDelete={false} onDelete={jest.fn()} onToggleLike={onToggleLike} />,
    );
    expect(screen.getByText('♡ 3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'いいね' }));
    expect(onToggleLike).toHaveBeenCalledWith('p1', true);
  });

  it('いいね済みなら、押すと取り消しで呼ぶ', async () => {
    const onToggleLike = jest.fn();
    await render(
      <PostCard
        post={post({ likedByMe: true, likeCount: 4 })}
        canDelete={false}
        onDelete={jest.fn()}
        onToggleLike={onToggleLike}
      />,
    );
    expect(screen.getByText('♥ 4')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'いいねを取り消す' }));
    expect(onToggleLike).toHaveBeenCalledWith('p1', false);
  });

  it('onToggleLike が無ければ、ボタンを出さない', async () => {
    await render(<PostCard post={post()} canDelete={false} onDelete={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'いいね' })).toBeNull();
  });
});

describe('PostCard のフォローボタン', () => {
  it('onToggleFollow が無ければ出ない', async () => {
    await render(<PostCard post={post()} canDelete={false} onDelete={jest.fn()} />);
    expect(screen.queryByRole('button', { name: '@alice をフォロー' })).toBeNull();
  });

  it('未フォローなら「フォロー」で、押すと follow=true で呼ぶ', async () => {
    const onToggleFollow = jest.fn();
    await render(
      <PostCard
        post={post()}
        canDelete={false}
        onDelete={jest.fn()}
        onToggleFollow={onToggleFollow}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: '@alice をフォロー' }));
    expect(onToggleFollow).toHaveBeenCalledWith('u1', true);
  });

  it('フォロー中なら「フォロー中」で、押すと follow=false で呼ぶ', async () => {
    const onToggleFollow = jest.fn();
    await render(
      <PostCard
        post={post()}
        canDelete={false}
        onDelete={jest.fn()}
        following
        onToggleFollow={onToggleFollow}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: '@alice のフォローを解除' }));
    expect(onToggleFollow).toHaveBeenCalledWith('u1', false);
  });
});

describe('PostCard のブックマークボタン', () => {
  it('未ブックマークなら、押すと追加で呼ぶ', async () => {
    const onToggleBookmark = jest.fn();
    await render(
      <PostCard
        post={post()}
        canDelete={false}
        onDelete={jest.fn()}
        onToggleBookmark={onToggleBookmark}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'ブックマーク' }));
    expect(onToggleBookmark).toHaveBeenCalledWith('p1', true);
  });

  it('ブックマーク済みなら、押すと解除で呼ぶ', async () => {
    const onToggleBookmark = jest.fn();
    await render(
      <PostCard
        post={post()}
        canDelete={false}
        onDelete={jest.fn()}
        bookmarked
        onToggleBookmark={onToggleBookmark}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'ブックマークを解除' }));
    expect(onToggleBookmark).toHaveBeenCalledWith('p1', false);
  });

  it('onToggleBookmark がなければボタンを出さない', async () => {
    await render(<PostCard post={post()} canDelete={false} onDelete={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'ブックマーク' })).toBeNull();
  });
});

import { createPost, deletePost, fetchTimeline } from '@/features/posts/posts-api';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const from = jest.mocked(supabase.from);

const row = {
  id: 'p1',
  author_id: 'u1',
  body: 'hello',
  created_at: '2026-11-24T00:00:00Z',
  profiles: { handle: 'alice', display_name: 'Alice' },
};

function chain(result: unknown) {
  const node: Record<string, jest.Mock> = {};
  for (const name of ['select', 'insert', 'delete', 'is', 'order', 'eq']) {
    node[name] = jest.fn(() => node);
  }
  node.limit = jest.fn().mockResolvedValue(result);
  node.single = jest.fn().mockResolvedValue(result);
  // delete().eq() は await される
  node.eq = jest.fn().mockResolvedValue(result);
  from.mockReturnValue(node as never);
  return node;
}

beforeEach(() => jest.clearAllMocks());

describe('fetchTimeline', () => {
  it('新しい順に読み、アプリ用の形に変換する', async () => {
    const node = chain({ data: [row], error: null });
    await expect(fetchTimeline()).resolves.toEqual([
      {
        id: 'p1',
        authorId: 'u1',
        body: 'hello',
        createdAt: '2026-11-24T00:00:00Z',
        author: { handle: 'alice', displayName: 'Alice' },
      },
    ]);
    expect(from).toHaveBeenCalledWith('posts');
    expect(node.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('失敗すると Error になる', async () => {
    chain({ data: null, error: { message: 'boom' } });
    await expect(fetchTimeline()).rejects.toThrow('タイムラインを読み込めませんでした: boom');
  });
});

describe('createPost', () => {
  it('author_id と本文を insert する', async () => {
    const node = chain({ data: row, error: null });
    await createPost('u1', 'hello');
    expect(node.insert).toHaveBeenCalledWith({ author_id: 'u1', body: 'hello' });
  });

  it('失敗すると Error になる', async () => {
    chain({ data: null, error: { message: 'denied' } });
    await expect(createPost('u1', 'x')).rejects.toThrow('投稿できませんでした: denied');
  });
});

describe('deletePost', () => {
  it('id を指定して delete する', async () => {
    const node = chain({ error: null });
    await deletePost('p1');
    expect(node.eq).toHaveBeenCalledWith('id', 'p1');
  });

  it('失敗すると Error になる', async () => {
    chain({ error: { message: 'denied' } });
    await expect(deletePost('p1')).rejects.toThrow('投稿を削除できませんでした: denied');
  });
});

import { createPost, deletePost, fetchTimelinePage } from '@/features/posts/posts-api';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

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

const rpc = jest.mocked(supabase.rpc);

const rpcRow = (n: number) => ({
  id: `p${n}`,
  author_id: 'u1',
  body: `body ${n}`,
  created_at: `2026-11-24T00:00:0${n}Z`,
  handle: 'alice',
  display_name: 'Alice',
});

describe('fetchTimelinePage', () => {
  it('RPC をカーソル付きで呼び、アプリ用の形に変換する', async () => {
    rpc.mockResolvedValue({ data: [rpcRow(2)], error: null } as never);
    const page = await fetchTimelinePage({ createdAt: 'c', id: 'i' }, 2);
    expect(rpc).toHaveBeenCalledWith('get_timeline', {
      p_before_created_at: 'c',
      p_before_id: 'i',
      p_limit: 2,
    });
    expect(page.posts[0]).toEqual({
      id: 'p2',
      authorId: 'u1',
      body: 'body 2',
      createdAt: '2026-11-24T00:00:02Z',
      author: { handle: 'alice', displayName: 'Alice' },
    });
    // 件数が limit に満たないので、続きはない
    expect(page.nextCursor).toBeNull();
  });

  it('limit 件そろったら、最後の投稿を次のカーソルにする', async () => {
    rpc.mockResolvedValue({ data: [rpcRow(2), rpcRow(1)], error: null } as never);
    const page = await fetchTimelinePage(null, 2);
    expect(rpc).toHaveBeenCalledWith('get_timeline', {
      p_before_created_at: undefined,
      p_before_id: undefined,
      p_limit: 2,
    });
    expect(page.nextCursor).toEqual({ createdAt: '2026-11-24T00:00:01Z', id: 'p1' });
  });

  it('失敗すると Error になる', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } } as never);
    await expect(fetchTimelinePage(null)).rejects.toThrow(
      'タイムラインを読み込めませんでした: boom',
    );
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

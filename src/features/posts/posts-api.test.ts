import {
  createPost,
  deletePost,
  fetchPost,
  fetchReplies,
  fetchTimelinePage,
  likePost,
  unlikePost,
} from '@/features/posts/posts-api';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const from = jest.mocked(supabase.from);

const row = {
  id: 'p1',
  author_id: 'u1',
  body: 'hello',
  created_at: '2026-11-24T00:00:00Z',
  reply_count: 0,
  like_count: 0,
  likes: [],
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
  reply_count: 3,
  like_count: 5,
  liked_by_me: true,
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
      replyCount: 3,
      likeCount: 5,
      likedByMe: true,
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

describe('createPost (リプライ)', () => {
  it('replyTo があれば reply_to を付けて insert する', async () => {
    const node = chain({ data: row, error: null });
    await createPost('u1', 'hi', 'p0');
    expect(node.insert).toHaveBeenCalledWith({ author_id: 'u1', body: 'hi', reply_to: 'p0' });
  });
});

describe('fetchPost', () => {
  it('id で 1 件読み、リプライ数を含めて変換する', async () => {
    const node = chain({ data: { ...row, reply_count: 2 }, error: null });
    node.maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { ...row, reply_count: 2 }, error: null });
    node.eq = jest.fn(() => node);
    const post = await fetchPost('p1');
    expect(node.eq).toHaveBeenCalledWith('id', 'p1');
    expect(post?.replyCount).toBe(2);
  });

  it('無ければ null', async () => {
    const node = chain({ data: null, error: null });
    node.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    node.eq = jest.fn(() => node);
    expect(await fetchPost('x')).toBeNull();
  });

  it('失敗すると Error になる', async () => {
    const node = chain({});
    node.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    node.eq = jest.fn(() => node);
    await expect(fetchPost('x')).rejects.toThrow('投稿を読み込めませんでした: boom');
  });
});

describe('fetchReplies', () => {
  it('reply_to で絞り、古い順に読む', async () => {
    const node = chain({ data: [row], error: null });
    node.eq = jest.fn(() => node);
    const replies = await fetchReplies('p0');
    expect(node.eq).toHaveBeenCalledWith('reply_to', 'p0');
    expect(node.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(replies).toHaveLength(1);
  });

  it('失敗すると Error になる', async () => {
    const node = chain({ data: null, error: { message: 'boom' } });
    node.eq = jest.fn(() => node);
    await expect(fetchReplies('p0')).rejects.toThrow('リプライを読み込めませんでした: boom');
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

describe('likePost', () => {
  it('likes に insert する', async () => {
    const node = chain({ error: null });
    node.insert = jest.fn().mockResolvedValue({ error: null });
    await likePost('u1', 'p1');
    expect(from).toHaveBeenCalledWith('likes');
    expect(node.insert).toHaveBeenCalledWith({ user_id: 'u1', post_id: 'p1' });
  });

  it('すでにいいね済み (23505) は成功として扱う', async () => {
    const node = chain({});
    node.insert = jest.fn().mockResolvedValue({ error: { code: '23505', message: 'dup' } });
    await expect(likePost('u1', 'p1')).resolves.toBeUndefined();
  });

  it('それ以外の失敗は Error になる', async () => {
    const node = chain({});
    node.insert = jest.fn().mockResolvedValue({ error: { code: '42501', message: 'denied' } });
    await expect(likePost('u1', 'p1')).rejects.toThrow('いいねできませんでした: denied');
  });
});

describe('unlikePost', () => {
  it('自分の行だけを delete する', async () => {
    const node = chain({ error: null });
    node.eq = jest.fn().mockReturnValueOnce(node).mockResolvedValueOnce({ error: null });
    await unlikePost('u1', 'p1');
    expect(node.eq).toHaveBeenNthCalledWith(1, 'user_id', 'u1');
    expect(node.eq).toHaveBeenNthCalledWith(2, 'post_id', 'p1');
  });

  it('失敗すると Error になる', async () => {
    const node = chain({});
    node.eq = jest
      .fn()
      .mockReturnValueOnce(node)
      .mockResolvedValueOnce({ error: { message: 'x' } });
    await expect(unlikePost('u1', 'p1')).rejects.toThrow('いいねを取り消せませんでした: x');
  });
});

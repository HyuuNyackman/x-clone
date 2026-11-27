import {
  addBookmark,
  createPost,
  deletePost,
  fetchBookmarkedIds,
  fetchBookmarkedPosts,
  fetchFollowingIds,
  fetchPost,
  followUser,
  fetchRepliesPage,
  fetchUserPostsPage,
  fetchTimelinePage,
  likePost,
  removeBookmark,
  unfollowUser,
  unlikePost,
} from '@/features/posts/posts-api';
import { removeImages, uploadImage } from '@/features/media/media-api';
import { supabase } from '@/lib/supabase';

jest.mock('@/features/media/media-api', () => ({
  uploadImage: jest.fn(),
  removeImages: jest.fn(),
}));
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
  profiles: { handle: 'alice', display_name: 'Alice', avatar_url: null },
};

function chain(result: unknown) {
  const node: Record<string, jest.Mock> = {};
  for (const name of ['select', 'insert', 'delete', 'is', 'order', 'eq', 'or']) {
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

// post_media の取得 (from('post_media').select().in()) を差し替える。
function mediaRows(rows: unknown[]) {
  const node: Record<string, jest.Mock> = {
    select: jest.fn(() => node),
    in: jest.fn().mockResolvedValue({ data: rows, error: null }),
  };
  from.mockReturnValue(node as never);
  return node;
}

const rpcRow = (n: number) => ({
  id: `p${n}`,
  author_id: 'u1',
  body: `body ${n}`,
  created_at: `2026-11-24T00:00:0${n}Z`,
  handle: 'alice',
  display_name: 'Alice',
  avatar_url: null,
  reply_count: 3,
  like_count: 5,
  liked_by_me: true,
});

describe('fetchTimelinePage', () => {
  it('RPC をカーソル付きで呼び、アプリ用の形に変換する', async () => {
    rpc.mockResolvedValue({ data: [rpcRow(2)], error: null } as never);
    mediaRows([
      { post_id: 'p2', storage_key: 'u1/b.jpg', width: 10, height: 20, sort_order: 1 },
      { post_id: 'p2', storage_key: 'u1/a.jpg', width: 30, height: 40, sort_order: 0 },
    ]);
    const page = await fetchTimelinePage({ createdAt: 'c', id: 'i' }, 2);
    expect(rpc).toHaveBeenCalledWith('get_timeline', {
      p_before_created_at: 'c',
      p_before_id: 'i',
      p_limit: 2,
      p_following_only: false,
    });
    expect(page.posts[0]).toEqual({
      id: 'p2',
      authorId: 'u1',
      body: 'body 2',
      createdAt: '2026-11-24T00:00:02Z',
      replyCount: 3,
      likeCount: 5,
      likedByMe: true,
      author: { handle: 'alice', displayName: 'Alice', avatarUrl: null },
      // 表示順 (sort_order) に並ぶ
      media: [
        { storageKey: 'u1/a.jpg', width: 30, height: 40 },
        { storageKey: 'u1/b.jpg', width: 10, height: 20 },
      ],
    });
    // 件数が limit に満たないので、続きはない
    expect(page.nextCursor).toBeNull();
  });

  it('limit 件そろったら、最後の投稿を次のカーソルにする', async () => {
    rpc.mockResolvedValue({ data: [rpcRow(2), rpcRow(1)], error: null } as never);
    mediaRows([]);
    const page = await fetchTimelinePage(null, 2);
    expect(rpc).toHaveBeenCalledWith('get_timeline', {
      p_before_created_at: undefined,
      p_before_id: undefined,
      p_limit: 2,
      p_following_only: false,
    });
    expect(page.nextCursor).toEqual({ createdAt: '2026-11-24T00:00:01Z', id: 'p1' });
  });

  it('followingOnly なら、p_following_only を true で呼ぶ', async () => {
    rpc.mockResolvedValue({ data: [], error: null } as never);
    await fetchTimelinePage(null, 2, true);
    expect(rpc).toHaveBeenCalledWith('get_timeline', {
      p_before_created_at: undefined,
      p_before_id: undefined,
      p_limit: 2,
      p_following_only: true,
    });
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

describe('createPost (画像付き)', () => {
  const image = { uri: 'file:///a.jpg', width: 800, height: 600, bytes: 1000 };

  it('画像をアップロードし、キーを post_media に順番つきで保存する', async () => {
    jest.mocked(uploadImage).mockResolvedValueOnce('u1/k0.jpg').mockResolvedValueOnce('u1/k1.jpg');
    const posts = chain({ data: row, error: null });
    const media = { insert: jest.fn().mockResolvedValue({ error: null }) };
    from.mockReturnValueOnce(posts as never).mockReturnValueOnce(media as never);

    const post = await createPost('u1', 'hi', undefined, [image, image]);

    expect(uploadImage).toHaveBeenCalledWith('post-media', 'u1', image);
    expect(media.insert).toHaveBeenCalledWith([
      { post_id: 'p1', storage_key: 'u1/k0.jpg', width: 800, height: 600, sort_order: 0 },
      { post_id: 'p1', storage_key: 'u1/k1.jpg', width: 800, height: 600, sort_order: 1 },
    ]);
    expect(post.media).toHaveLength(2);
  });

  it('post_media の保存に失敗したら、投稿と画像を片付ける', async () => {
    jest.mocked(uploadImage).mockResolvedValueOnce('u1/k0.jpg');
    const posts = chain({ data: row, error: null });
    const media = { insert: jest.fn().mockResolvedValue({ error: { message: 'denied' } }) };
    const cleanup: Record<string, jest.Mock> = {
      delete: jest.fn(() => cleanup),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    from
      .mockReturnValueOnce(posts as never)
      .mockReturnValueOnce(media as never)
      .mockReturnValueOnce(cleanup as never);

    await expect(createPost('u1', 'hi', undefined, [image])).rejects.toThrow(
      '画像を保存できませんでした: denied',
    );
    expect(cleanup.eq).toHaveBeenCalledWith('id', 'p1');
    expect(removeImages).toHaveBeenCalledWith('post-media', ['u1/k0.jpg']);
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

describe('fetchRepliesPage', () => {
  it('reply_to で絞り、古い順に読む。カーソルが無ければ or は付けない', async () => {
    const node = chain({ data: [row], error: null });
    node.eq = jest.fn(() => node);
    const page = await fetchRepliesPage('p0', null);
    expect(node.eq).toHaveBeenCalledWith('reply_to', 'p0');
    expect(node.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(node.or).not.toHaveBeenCalled();
    expect(page.posts).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('カーソルより後ろだけを読み、limit 件そろったら次のカーソルを返す', async () => {
    const node = chain({ data: [row], error: null });
    node.eq = jest.fn(() => node);
    const page = await fetchRepliesPage('p0', { createdAt: 'c', id: 'i' }, undefined, 1);
    expect(node.or).toHaveBeenCalledWith('created_at.gt."c",and(created_at.eq."c",id.gt.i)');
    expect(node.limit).toHaveBeenCalledWith(1);
    expect(page.nextCursor).toEqual({ createdAt: row.created_at, id: 'p1' });
  });

  it('失敗すると Error になる', async () => {
    const node = chain({ data: null, error: { message: 'boom' } });
    node.eq = jest.fn(() => node);
    await expect(fetchRepliesPage('p0', null)).rejects.toThrow(
      'リプライを読み込めませんでした: boom',
    );
  });
});

describe('fetchUserPostsPage', () => {
  it('投稿者で絞り、リプライを除いて新しい順に読む', async () => {
    const node = chain({ data: [row], error: null });
    node.eq = jest.fn(() => node);
    const page = await fetchUserPostsPage('u1', null);
    expect(node.eq).toHaveBeenCalledWith('author_id', 'u1');
    expect(node.is).toHaveBeenCalledWith('reply_to', null);
    expect(node.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(page.nextCursor).toBeNull();
  });

  it('カーソルより前だけを読み、limit 件そろったら次のカーソルを返す', async () => {
    const node = chain({ data: [row], error: null });
    node.eq = jest.fn(() => node);
    const page = await fetchUserPostsPage('u1', { createdAt: 'c', id: 'i' }, undefined, 1);
    expect(node.or).toHaveBeenCalledWith('created_at.lt."c",and(created_at.eq."c",id.lt.i)');
    expect(page.nextCursor).toEqual({ createdAt: row.created_at, id: 'p1' });
  });

  it('失敗すると Error になる', async () => {
    const node = chain({ data: null, error: { message: 'boom' } });
    node.eq = jest.fn(() => node);
    await expect(fetchUserPostsPage('u1', null)).rejects.toThrow(
      '投稿を読み込めませんでした: boom',
    );
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

describe('フォロー', () => {
  it('fetchFollowingIds は followee_id の配列を返す', async () => {
    const node = chain({});
    node.eq = jest.fn(() => node);
    node.in = jest.fn().mockResolvedValue({
      data: [{ followee_id: 'u2' }, { followee_id: 'u3' }],
      error: null,
    });
    await expect(fetchFollowingIds('u1', ['u2', 'u3', 'u4'])).resolves.toEqual(['u2', 'u3']);
    expect(from).toHaveBeenCalledWith('follows');
    expect(node.eq).toHaveBeenCalledWith('follower_id', 'u1');
    expect(node.in).toHaveBeenCalledWith('followee_id', ['u2', 'u3', 'u4']);
  });

  it('fetchFollowingIds は投稿者が 0 人なら問い合わせない', async () => {
    await expect(fetchFollowingIds('u1', [])).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('followUser は insert する。重複 (23505) は成功として扱う', async () => {
    const node = chain({});
    node.insert = jest.fn().mockResolvedValue({ error: { code: '23505', message: 'dup' } });
    await expect(followUser('u1', 'u2')).resolves.toBeUndefined();
    expect(node.insert).toHaveBeenCalledWith({ follower_id: 'u1', followee_id: 'u2' });
  });

  it('followUser はそれ以外のエラーで Error になる', async () => {
    const node = chain({});
    node.insert = jest.fn().mockResolvedValue({ error: { code: '42501', message: 'nope' } });
    await expect(followUser('u1', 'u2')).rejects.toThrow('フォローできませんでした: nope');
  });

  it('unfollowUser は自分と相手で絞って delete する', async () => {
    const node = chain({});
    node.eq = jest.fn().mockReturnValueOnce(node).mockResolvedValueOnce({ error: null });
    await unfollowUser('u1', 'u2');
    expect(node.eq).toHaveBeenNthCalledWith(1, 'follower_id', 'u1');
    expect(node.eq).toHaveBeenNthCalledWith(2, 'followee_id', 'u2');
  });
});

describe('ブックマーク', () => {
  it('addBookmark は重複 (23505) を成功として扱い、他のエラーは投げる', async () => {
    const node = chain({ error: { code: '23505', message: 'dup' } });
    node.insert = jest.fn().mockResolvedValue({ error: { code: '23505', message: 'dup' } });
    await expect(addBookmark('u1', 'p1')).resolves.toBeUndefined();
    expect(node.insert).toHaveBeenCalledWith({ user_id: 'u1', post_id: 'p1' });

    node.insert = jest.fn().mockResolvedValue({ error: { code: '42501', message: 'denied' } });
    await expect(addBookmark('u1', 'p1')).rejects.toThrow('ブックマークできませんでした');
  });

  it('removeBookmark は user_id と post_id で絞って消す', async () => {
    const node = chain({ error: null });
    node.eq = jest.fn().mockReturnValueOnce(node).mockResolvedValueOnce({ error: null });
    await expect(removeBookmark('u1', 'p1')).resolves.toBeUndefined();
    expect(node.eq).toHaveBeenNthCalledWith(1, 'user_id', 'u1');
    expect(node.eq).toHaveBeenNthCalledWith(2, 'post_id', 'p1');
  });

  it('fetchBookmarkedIds は post_id の配列を返す', async () => {
    const node = chain({ data: [], error: null });
    node.eq = jest
      .fn()
      .mockResolvedValue({ data: [{ post_id: 'p1' }, { post_id: 'p2' }], error: null });
    await expect(fetchBookmarkedIds('u1')).resolves.toEqual(['p1', 'p2']);
  });
});

describe('fetchBookmarkedPosts', () => {
  const mark = (n: number, createdAt = `2026-11-25T00:00:${String(n).padStart(2, '0')}Z`) => ({
    post_id: `p${n}`,
    created_at: createdAt,
  });
  const postRow = (id: string) => ({ ...row, id });

  // from('bookmarks') と from('posts') を、それぞれの結果で差し替える。
  function tables(marks: unknown, posts: unknown = { data: [], error: null }) {
    const markNode: Record<string, jest.Mock> = {};
    for (const name of ['select', 'eq', 'or', 'order']) markNode[name] = jest.fn(() => markNode);
    markNode.limit = jest.fn().mockResolvedValue(marks);
    const postNode: Record<string, jest.Mock> = {};
    for (const name of ['select', 'in']) postNode[name] = jest.fn(() => postNode);
    postNode.eq = jest.fn().mockResolvedValue(posts);
    from.mockImplementation(((table: string) =>
      table === 'bookmarks' ? markNode : postNode) as never);
    return { markNode, postNode };
  }

  it('カーソルなしで先頭の 20 件と次のカーソルを返す', async () => {
    const marks = Array.from({ length: 20 }, (_, i) => mark(20 - i));
    const { markNode, postNode } = tables(
      { data: marks, error: null },
      // posts は順不同で返ってくる
      { data: [...marks].reverse().map((m) => postRow(m.post_id)), error: null },
    );
    const page = await fetchBookmarkedPosts('u1');
    expect(markNode.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(markNode.or).not.toHaveBeenCalled();
    expect(markNode.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
    expect(markNode.order).toHaveBeenNthCalledWith(2, 'post_id', { ascending: false });
    expect(markNode.limit).toHaveBeenCalledWith(20);
    expect(postNode.in).toHaveBeenCalledWith(
      'id',
      marks.map((m) => m.post_id),
    );
    // ブックマークした順に並べ直す
    expect(page.posts.map((p) => p.id)).toEqual(marks.map((m) => m.post_id));
    expect(page.nextCursor).toEqual({ createdAt: marks[19].created_at, postId: 'p1' });
  });

  it('20 件未満なら次のカーソルは null', async () => {
    tables(
      { data: [mark(2), mark(1)], error: null },
      { data: [postRow('p1'), postRow('p2')], error: null },
    );
    const page = await fetchBookmarkedPosts('u1');
    expect(page.posts.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(page.nextCursor).toBeNull();
  });

  it('カーソルを渡すと、(created_at, post_id) がその前の行から読む', async () => {
    const at = '2026-11-25T00:00:00.123456+00:00';
    const { markNode } = tables(
      { data: [mark(3, at)], error: null },
      { data: [postRow('p3')], error: null },
    );
    const page = await fetchBookmarkedPosts('u1', { createdAt: at, postId: 'p5' }, 1);
    // 同じ時刻の行は post_id で境目を決め、重複も抜けもなく続きを読む。
    expect(markNode.or).toHaveBeenCalledWith(
      `created_at.lt."${at}",and(created_at.eq."${at}",post_id.lt.p5)`,
    );
    expect(page.nextCursor).toEqual({ createdAt: at, postId: 'p3' });
  });

  it('投稿が消えて飛ばした分があっても、ブックマークの行が limit 件なら続きがある', async () => {
    tables({ data: [mark(2), mark(1)], error: null }, { data: [postRow('p2')], error: null });
    const page = await fetchBookmarkedPosts('u1', null, 2);
    expect(page.posts.map((p) => p.id)).toEqual(['p2']);
    expect(page.nextCursor).toEqual({ createdAt: mark(1).created_at, postId: 'p1' });
  });

  it('0 件なら空の配列で、posts を読まない', async () => {
    tables({ data: [], error: null });
    await expect(fetchBookmarkedPosts('u1')).resolves.toEqual({ posts: [], nextCursor: null });
    expect(from).not.toHaveBeenCalledWith('posts');
  });

  it('失敗すると Error になる', async () => {
    tables({ data: null, error: { message: 'boom' } });
    await expect(fetchBookmarkedPosts('u1')).rejects.toThrow(
      'ブックマークを読み込めませんでした: boom',
    );
    tables({ data: [mark(1)], error: null }, { data: null, error: { message: 'nope' } });
    await expect(fetchBookmarkedPosts('u1')).rejects.toThrow('投稿を読み込めませんでした: nope');
  });
});

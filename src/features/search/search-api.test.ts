import { searchPostsPage, searchUsers } from '@/features/search/search-api';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const rpc = jest.mocked(supabase.rpc);

beforeEach(() => jest.clearAllMocks());

describe('searchPostsPage', () => {
  it('search_posts を呼び、投稿に変換する', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: 'p1',
          author_id: 'u1',
          body: 'hello',
          created_at: '2026-11-25T00:00:00Z',
          handle: 'alice',
          display_name: 'Alice',
          avatar_url: 'u1/a.jpg',
          reply_count: 1,
          like_count: 2,
          liked_by_me: true,
        },
      ],
      error: null,
    } as never);
    const select = jest.fn(() => ({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }));
    jest.mocked(supabase.from).mockReturnValue({ select } as never);

    const page = await searchPostsPage('hello', null);
    expect(rpc).toHaveBeenCalledWith('search_posts', {
      p_query: 'hello',
      p_before_created_at: undefined,
      p_before_id: undefined,
      p_limit: 20,
    });
    expect(page.posts[0]).toMatchObject({
      id: 'p1',
      likedByMe: true,
      author: { handle: 'alice', avatarUrl: 'u1/a.jpg' },
    });
    expect(page.nextCursor).toBeNull();
  });

  it('失敗したらエラーを投げる', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } } as never);
    await expect(searchPostsPage('x', null)).rejects.toThrow('boom');
  });
});

describe('searchUsers', () => {
  it('search_users を呼び、プロフィールに変換する', async () => {
    rpc.mockResolvedValue({
      data: [{ id: 'u1', handle: 'alice', display_name: 'Alice', avatar_url: null, bio: 'hi' }],
      error: null,
    } as never);
    expect(await searchUsers('ali')).toEqual([
      { id: 'u1', handle: 'alice', displayName: 'Alice', avatarUrl: null, bio: 'hi' },
    ]);
    expect(rpc).toHaveBeenCalledWith('search_users', { p_query: 'ali', p_limit: 20 });
  });
});

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/notifications-api';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const from = jest.mocked(supabase.from);

// 呼ばれた順に何でも返せる、await 可能なチェーン。
function chain(result: unknown) {
  const node: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const name of ['select', 'update', 'order', 'eq', 'is', 'limit']) {
    node[name] = jest.fn(() => node);
  }
  node.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  from.mockReturnValue(node as never);
  return node;
}

beforeEach(() => jest.clearAllMocks());

describe('fetchNotifications', () => {
  it('新しい順に取り、アプリ用の形に変換する', async () => {
    const node = chain({
      data: [
        {
          id: 'n1',
          type: 'like',
          post_id: 'p1',
          read_at: null,
          created_at: '2026-11-25T00:00:00Z',
          profiles: { handle: 'bob', display_name: 'Bob', avatar_url: 'u2/a.jpg' },
          posts: { body: 'hello' },
        },
        {
          id: 'n2',
          type: 'follow',
          post_id: null,
          read_at: '2026-11-25T01:00:00Z',
          created_at: '2026-11-24T00:00:00Z',
          profiles: { handle: 'carol', display_name: 'Carol', avatar_url: null },
          posts: null,
        },
      ],
      error: null,
    });

    const result = await fetchNotifications();

    expect(from).toHaveBeenCalledWith('notifications');
    expect(node.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual([
      {
        id: 'n1',
        type: 'like',
        actor: { handle: 'bob', displayName: 'Bob', avatarUrl: 'u2/a.jpg' },
        postId: 'p1',
        postBody: 'hello',
        read: false,
        createdAt: '2026-11-25T00:00:00Z',
      },
      {
        id: 'n2',
        type: 'follow',
        actor: { handle: 'carol', displayName: 'Carol', avatarUrl: null },
        postId: null,
        postBody: null,
        read: true,
        createdAt: '2026-11-24T00:00:00Z',
      },
    ]);
  });

  it('エラーなら例外を投げる', async () => {
    chain({ data: null, error: { message: 'boom' } });
    await expect(fetchNotifications()).rejects.toThrow('boom');
  });
});

describe('fetchUnreadCount', () => {
  it('未読 (read_at が null) の件数を返す', async () => {
    const node = chain({ count: 4, error: null });
    await expect(fetchUnreadCount()).resolves.toBe(4);
    expect(node.is).toHaveBeenCalledWith('read_at', null);
  });
});

describe('markNotificationRead / markAllNotificationsRead', () => {
  it('1 件を、未読の行だけ更新する', async () => {
    const node = chain({ error: null });
    await markNotificationRead('n1');
    expect(node.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(node.eq).toHaveBeenCalledWith('id', 'n1');
    expect(node.is).toHaveBeenCalledWith('read_at', null);
  });

  it('すべて既読にする', async () => {
    const node = chain({ error: null });
    await markAllNotificationsRead();
    expect(node.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(node.is).toHaveBeenCalledWith('read_at', null);
  });

  it('エラーなら例外を投げる', async () => {
    chain({ error: { message: 'denied' } });
    await expect(markAllNotificationsRead()).rejects.toThrow('denied');
  });
});

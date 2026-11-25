import {
  fetchFollowCounts,
  fetchProfile,
  fetchProfileByHandle,
  initialHandleFor,
  needsProfileSetup,
  ProfileFieldError,
  updateProfile,
} from '@/features/profile/profile-api';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const from = jest.mocked(supabase.from);

const USER_ID = 'a1000000-0000-0000-0000-000000000001';
const row = {
  id: USER_ID,
  handle: 'alice',
  display_name: 'Alice',
  avatar_url: null,
  bio: 'hello',
};

// from().select().eq().single() / from().update().eq().select().single() の連鎖を差し替える。
function chain(result: unknown) {
  const single = jest.fn().mockResolvedValue(result);
  const node: Record<string, jest.Mock> = {};
  node.select = jest.fn(() => node);
  node.update = jest.fn(() => node);
  node.eq = jest.fn(() => node);
  node.single = single;
  from.mockReturnValue(node as never);
  return node;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('initialHandleFor / needsProfileSetup', () => {
  it('サインアップ時のトリガーと同じ初期 handle を作る', () => {
    expect(initialHandleFor(USER_ID)).toBe('user_a100000000');
  });

  it('初期 handle のままなら、設定が必要', () => {
    const profile = {
      id: USER_ID,
      handle: 'user_a100000000',
      displayName: 'x',
      avatarUrl: null,
      bio: '',
    };
    expect(needsProfileSetup(profile)).toBe(true);
    expect(needsProfileSetup({ ...profile, handle: 'alice' })).toBe(false);
  });
});

describe('fetchProfile', () => {
  it('自分の行を読み、アプリ用の形に変換する', async () => {
    const node = chain({ data: row, error: null });
    await expect(fetchProfile(USER_ID)).resolves.toEqual({
      id: USER_ID,
      handle: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
      bio: 'hello',
    });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(node.eq).toHaveBeenCalledWith('id', USER_ID);
  });

  it('失敗すると Error になる', async () => {
    chain({ data: null, error: { message: 'boom' } });
    await expect(fetchProfile(USER_ID)).rejects.toThrow('プロフィールを読み込めませんでした: boom');
  });
});

describe('updateProfile', () => {
  const values = { handle: 'alice', displayName: 'Alice', bio: 'hello' };

  it('handle・表示名・bio だけを更新する', async () => {
    const node = chain({ data: row, error: null });
    await updateProfile(USER_ID, values);
    expect(node.update).toHaveBeenCalledWith({
      handle: 'alice',
      display_name: 'Alice',
      bio: 'hello',
    });
    expect(node.eq).toHaveBeenCalledWith('id', USER_ID);
  });

  it('handle が重複すると、handle 欄のエラーになる', async () => {
    chain({ data: null, error: { code: '23505', message: 'duplicate key' } });
    const error = await updateProfile(USER_ID, values).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProfileFieldError);
    expect(error).toMatchObject({
      field: 'handle',
      message: 'このハンドルは既に使われています',
    });
  });

  it('その他の失敗は、通常の Error になる', async () => {
    chain({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(updateProfile(USER_ID, values)).rejects.toThrow(
      'プロフィールを保存できませんでした: denied',
    );
  });
});

describe('fetchProfileByHandle', () => {
  it('handle で引いて、プロフィールを返す。無ければ null', async () => {
    const maybeSingle = jest.fn().mockResolvedValueOnce({ data: row, error: null });
    const node: Record<string, jest.Mock> = {};
    node.select = jest.fn(() => node);
    node.eq = jest.fn(() => node);
    node.maybeSingle = maybeSingle;
    from.mockReturnValue(node as never);

    expect(await fetchProfileByHandle('alice')).toMatchObject({ id: USER_ID, handle: 'alice' });
    expect(node.eq).toHaveBeenCalledWith('handle', 'alice');

    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await fetchProfileByHandle('nobody')).toBeNull();
  });
});

describe('fetchFollowCounts', () => {
  it('フォロー数とフォロワー数を数える', async () => {
    from.mockImplementation((() => ({
      select: () => ({
        eq: (column: string) =>
          Promise.resolve({ count: column === 'follower_id' ? 3 : 5, error: null }),
      }),
    })) as never);
    expect(await fetchFollowCounts(USER_ID)).toEqual({ following: 3, followers: 5 });
  });

  it('失敗したら例外を投げる', async () => {
    from.mockImplementation((() => ({
      select: () => ({ eq: () => Promise.resolve({ count: null, error: { message: 'ng' } }) }),
    })) as never);
    await expect(fetchFollowCounts(USER_ID)).rejects.toThrow('ng');
  });
});

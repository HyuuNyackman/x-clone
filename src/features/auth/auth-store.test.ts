import type { Session } from '@supabase/supabase-js';

import { startAuthListener, useAuthStore } from '@/features/auth/auth-store';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

const auth = jest.mocked(supabase.auth);
const session = { access_token: 'token', user: { id: 'u1' } } as unknown as Session;

// getSession の Promise が解決し、then の中の処理が終わるまで待つ。
const flush = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

let emit: (event: string, next: Session | null) => void;
const unsubscribe = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: null, initialized: false });
  auth.onAuthStateChange.mockImplementation(((callback: typeof emit) => {
    emit = callback;
    return { data: { subscription: { unsubscribe } } };
  }) as never);
});

describe('startAuthListener', () => {
  it('起動前は、セッションがなく、初期化も終わっていない', () => {
    expect(useAuthStore.getState()).toEqual({ session: null, initialized: false });
  });

  it('保存済みのセッションを読み込んで、ストアに入れる', async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null } as never);
    startAuthListener();
    await flush();
    expect(useAuthStore.getState()).toEqual({ session, initialized: true });
  });

  it('保存済みのセッションがなければ、ログアウト状態で初期化を終える', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null } as never);
    startAuthListener();
    await flush();
    expect(useAuthStore.getState()).toEqual({ session: null, initialized: true });
  });

  it('セッションの読み込みに失敗しても、ログアウト状態で初期化を終える', async () => {
    auth.getSession.mockRejectedValue(new Error('storage error'));
    startAuthListener();
    await flush();
    expect(useAuthStore.getState()).toEqual({ session: null, initialized: true });
  });

  it('ログインとログアウトの通知を、ストアに反映する', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null } as never);
    startAuthListener();
    await flush();

    emit('SIGNED_IN', session);
    expect(useAuthStore.getState().session).toBe(session);

    emit('SIGNED_OUT', null);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('返された関数で、購読を解除できる', () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null } as never);
    const stop = startAuthListener();
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

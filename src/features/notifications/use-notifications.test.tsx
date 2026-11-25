import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/features/auth/auth-store';
import { useNotificationsRealtime } from '@/features/notifications/use-notifications';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: { channel: jest.fn(), removeChannel: jest.fn(), from: jest.fn() },
}));

const channelMock = jest.mocked(supabase.channel);

function setup() {
  const channel = { on: jest.fn(), subscribe: jest.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  channelMock.mockReturnValue(channel as never);
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { channel, invalidate, wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'u1' } } as never, initialized: true });
});

describe('useNotificationsRealtime', () => {
  it('自分宛ての notifications の INSERT だけを購読する', async () => {
    const { channel, wrapper } = setup();
    await renderHook(() => useNotificationsRealtime(), { wrapper });

    expect(channel.on).toHaveBeenCalledTimes(1);
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.u1' },
      expect.any(Function),
    );
  });

  it('INSERT が届いたら一覧とバッジを取り直す', async () => {
    const { channel, invalidate, wrapper } = setup();
    await renderHook(() => useNotificationsRealtime(), { wrapper });

    const handler = channel.on.mock.calls[0][2] as () => void;
    handler();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'list', 'u1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications', 'unread', 'u1'] });
  });

  it('アンマウントでチャンネルを外す', async () => {
    const { channel, wrapper } = setup();
    const { unmount } = await renderHook(() => useNotificationsRealtime(), { wrapper });
    await unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('ログインしていなければ購読しない', async () => {
    const { wrapper } = setup();
    useAuthStore.setState({ session: null });
    await renderHook(() => useNotificationsRealtime(), { wrapper });
    expect(channelMock).not.toHaveBeenCalled();
  });
});

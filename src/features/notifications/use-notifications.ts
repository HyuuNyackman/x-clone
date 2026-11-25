import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuthStore } from '@/features/auth/auth-store';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/features/notifications/notifications-api';
import { supabase } from '@/lib/supabase';

export const notificationsKey = (userId: string | undefined) =>
  ['notifications', 'list', userId] as const;
export const unreadCountKey = (userId: string | undefined) =>
  ['notifications', 'unread', userId] as const;

export function useNotifications() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: notificationsKey(userId),
    queryFn: fetchNotifications,
    enabled: Boolean(userId),
  });
}

export function useUnreadCount() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return useQuery({
    queryKey: unreadCountKey(userId),
    queryFn: fetchUnreadCount,
    enabled: Boolean(userId),
  });
}

// 自分宛ての notifications の INSERT だけを購読し、届いたら一覧とバッジを取り直す。
// フィルタはサーバー側にも効くが、RLS により他人の行は元々届かない。
// タイムラインなど他のテーブルは購読しない (無料枠のメッセージ数・同時接続の制限のため)。
export function useNotificationsRealtime() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKey(userId) });
      void queryClient.invalidateQueries({ queryKey: unreadCountKey(userId) });
    };
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        refresh,
      )
      .subscribe((status) => {
        // つなぎ直したときは、切れていた間の通知を取りこぼさないよう取り直す。
        if (status === 'SUBSCRIBED') refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

// 既読にする。押した瞬間に表示とバッジを変え、失敗したら戻す (楽観的更新)。
export function useMarkRead() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();
  const listKey = notificationsKey(userId);
  const countKey = unreadCountKey(userId);

  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ]);
      const previousList = queryClient.getQueryData<AppNotification[]>(listKey);
      const previousCount = queryClient.getQueryData<number>(countKey);
      const target = previousList?.find((n) => n.id === id);
      queryClient.setQueryData<AppNotification[]>(listKey, (old) =>
        old?.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      if (target && !target.read) {
        queryClient.setQueryData<number>(countKey, (old) => Math.max((old ?? 0) - 1, 0));
      }
      return { previousList, previousCount };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(listKey, context?.previousList);
      queryClient.setQueryData(countKey, context?.previousCount);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey }),
        queryClient.invalidateQueries({ queryKey: countKey }),
      ]),
  });
}

// すべて既読にする。
export function useMarkAllRead() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();
  const listKey = notificationsKey(userId);
  const countKey = unreadCountKey(userId);

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ]);
      const previousList = queryClient.getQueryData<AppNotification[]>(listKey);
      const previousCount = queryClient.getQueryData<number>(countKey);
      queryClient.setQueryData<AppNotification[]>(listKey, (old) =>
        old?.map((n) => ({ ...n, read: true })),
      );
      queryClient.setQueryData<number>(countKey, 0);
      return { previousList, previousCount };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(listKey, context?.previousList);
      queryClient.setQueryData(countKey, context?.previousCount);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey }),
        queryClient.invalidateQueries({ queryKey: countKey }),
      ]),
  });
}

import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { notificationMessage } from '@/features/notifications/notification-text';
import type { AppNotification } from '@/features/notifications/notifications-api';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/use-notifications';

export default function NotificationsScreen() {
  const notifications = useNotifications();
  const unread = useUnreadCount().data ?? 0;
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const open = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.type === 'follow') {
      router.push({ pathname: '/user/[handle]', params: { handle: n.actor.handle } });
    } else if (n.postId) {
      router.push({ pathname: '/post/[id]', params: { id: n.postId } });
    }
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Text className="text-xl font-extrabold text-foreground">通知</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="すべて既読にする"
          disabled={unread === 0 || markAllRead.isPending}
          onPress={() => markAllRead.mutate()}
          hitSlop={8}
        >
          <Text className={unread === 0 ? 'text-sm text-muted' : 'text-sm font-bold text-primary'}>
            すべて既読にする
          </Text>
        </Pressable>
      </View>
      {notifications.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{notifications.error.message}</Text>
      ) : null}
      {markRead.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{markRead.error.message}</Text>
      ) : null}
      {markAllRead.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{markAllRead.error.message}</Text>
      ) : null}
      <FlashList
        data={notifications.data ?? []}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${notificationMessage(item)}${item.read ? '' : ' (未読)'}`}
            onPress={() => open(item)}
            className={`gap-1 border-b border-border px-4 py-3 ${item.read ? '' : 'bg-surface'}`}
          >
            <View className="flex-row items-center gap-2">
              {item.read ? null : <View className="h-2 w-2 rounded-full bg-primary" />}
              <Text className={`flex-1 text-base text-foreground ${item.read ? '' : 'font-bold'}`}>
                {notificationMessage(item)}
              </Text>
            </View>
            {item.postBody ? (
              <Text className="text-sm text-muted" numberOfLines={2}>
                {item.postBody}
              </Text>
            ) : null}
          </Pressable>
        )}
        refreshing={notifications.isRefetching}
        onRefresh={() => void notifications.refetch()}
        ListEmptyComponent={
          <Text className="px-4 py-6 text-center text-muted">
            {notifications.isPending ? '読み込み中…' : '通知はまだありません'}
          </Text>
        }
      />
    </Screen>
  );
}

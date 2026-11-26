import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { badgeLabel } from '@/features/notifications/notification-text';
import {
  useNotificationsRealtime,
  useUnreadCount,
} from '@/features/notifications/use-notifications';
import { needsProfileSetup } from '@/features/profile/profile-api';
import { useProfile } from '@/features/profile/use-profile';

export default function TabsLayout() {
  const profile = useProfile();
  const unread = useUnreadCount().data;
  // 通知の INSERT だけを購読する。タブにいる間だけつなぐ。
  useNotificationsRealtime();

  if (profile.isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  // 初回ログイン直後は、handle と表示名の設定を先に済ませる。
  // 読み込みに失敗したときは、アプリを使えなくならないよう、そのままタブを出す。
  if (profile.data && needsProfileSetup(profile.data)) {
    return <Redirect href="/profile-setup" />;
  }

  return (
    // tabBarIcon を指定しないと、既定の代替文字「⏷」が各タブに出る。
    // アイコンの部品はまだ入れていないので、空のアイコンにしてラベルだけを出す。
    <Tabs screenOptions={{ headerShown: false, tabBarIcon: () => null }}>
      <Tabs.Screen name="home" options={{ title: 'ホーム' }} />
      <Tabs.Screen name="search" options={{ title: '検索' }} />
      <Tabs.Screen
        name="notifications"
        options={{ title: '通知', tabBarBadge: badgeLabel(unread) }}
      />
      <Tabs.Screen name="bookmarks" options={{ title: 'ブックマーク' }} />
      <Tabs.Screen name="profile" options={{ title: 'プロフィール' }} />
      <Tabs.Screen name="settings" options={{ title: '設定' }} />
    </Tabs>
  );
}

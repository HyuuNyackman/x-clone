import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { needsProfileSetup } from '@/features/profile/profile-api';
import { useProfile } from '@/features/profile/use-profile';

export default function TabsLayout() {
  const profile = useProfile();

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
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: 'ホーム' }} />
      <Tabs.Screen name="profile" options={{ title: 'プロフィール' }} />
      <Tabs.Screen name="settings" options={{ title: '設定' }} />
    </Tabs>
  );
}

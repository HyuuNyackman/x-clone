import '../../global.css';

import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';

import { useAuthListener } from '@/features/auth/use-auth-listener';
import { useAuthStore } from '@/features/auth/auth-store';
import { useApplyThemePreference } from '@/features/theme/use-theme-preference';
import { Providers } from '@/lib/providers';

function RootStack() {
  const { colorScheme } = useColorScheme();
  useApplyThemePreference();
  useAuthListener();
  const initialized = useAuthStore((state) => state.initialized);
  const isLoggedIn = useAuthStore((state) => state.session !== null);

  // 保存済みセッションの読み込みが終わるまで、画面を出さない (ログイン画面が一瞬見えるのを防ぐ)。
  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
      >
        <Stack.Protected guard={isLoggedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile-setup" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <StatusBar style={colorScheme === 'light' ? 'dark' : 'light'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <RootStack />
    </Providers>
  );
}

import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';

import { useApplyThemePreference } from '@/features/theme/use-theme-preference';
import { Providers } from '@/lib/providers';

function RootStack() {
  const { colorScheme } = useColorScheme();
  useApplyThemePreference();

  return (
    <>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
      />
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

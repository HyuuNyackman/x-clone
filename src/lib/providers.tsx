import { QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query-client';
import { themeVars } from '@/theme/tokens';

export function Providers({ children }: { children: ReactNode }) {
  const { colorScheme } = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* テーマの CSS 変数をここで注入する。配下の bg-background などが切り替わる */}
        <View style={themeVars[colorScheme ?? 'dark']} className="flex-1 bg-background">
          {children}
        </View>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

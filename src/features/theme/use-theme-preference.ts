import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';

import { useThemeStore } from '@/features/theme/theme-store';

// ストアの設定を NativeWind のカラースキームへ反映する
export function useApplyThemePreference() {
  const preference = useThemeStore((state) => state.preference);
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);
}

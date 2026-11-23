import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useThemeStore } from '@/features/theme/theme-store';

// Tailwind のクラスとテーマの切り替えが効いているかを確認する仮の画面
export default function HomeScreen() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="text-3xl font-extrabold text-foreground">x-clone</Text>
        <Text className="text-base text-muted">テーマ: {preference}</Text>
        <View className="w-full gap-3 rounded-2xl border border-border bg-surface p-4">
          <Button label="ダーク" onPress={() => setPreference('dark')} />
          <Button label="ライト" variant="outline" onPress={() => setPreference('light')} />
          <Button
            label="端末に合わせる"
            variant="outline"
            onPress={() => setPreference('system')}
          />
        </View>
      </View>
    </Screen>
  );
}

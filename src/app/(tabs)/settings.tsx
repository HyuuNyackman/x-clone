import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { signOut } from '@/features/auth/auth-api';
import { useAuthStore } from '@/features/auth/auth-store';

export default function SettingsScreen() {
  const email = useAuthStore((state) => state.session?.user.email);
  const [error, setError] = useState<string | null>(null);

  // 成功するとセッションが消え、ルートガードがログイン画面へ移す。
  const onSignOut = async () => {
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <View className="flex-1 justify-center gap-4 px-6">
        <Text className="text-base text-muted">ログイン中: {email}</Text>
        {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        <Button label="ログアウト" variant="outline" onPress={onSignOut} />
      </View>
    </Screen>
  );
}

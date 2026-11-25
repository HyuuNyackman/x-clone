import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useAuthStore } from '@/features/auth/auth-store';
import { initialHandleFor, ProfileFieldError } from '@/features/profile/profile-api';
import { ProfileForm } from '@/features/profile/profile-form';
import type { ProfileValues } from '@/features/profile/schemas';
import { useProfile, useSaveProfile } from '@/features/profile/use-profile';

// 初回ログイン後に、handle と表示名を決める画面。
export default function ProfileSetupScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const profile = useProfile();
  const save = useSaveProfile();

  const onSubmit = async (values: ProfileValues) => {
    // 初期 handle のままだと、設定済みと見なされず、この画面に戻される。
    if (userId && values.handle === initialHandleFor(userId)) {
      throw new ProfileFieldError('handle', 'ハンドルを自分で決めてください');
    }
    await save(values);
    router.replace('/home');
  };

  return (
    <Screen>
      <View className="flex-1 justify-center gap-4 px-6">
        <Text className="text-3xl font-extrabold text-foreground">プロフィールを設定</Text>
        <Text className="text-base text-muted">
          ハンドルと表示名を決めてください。あとから変更できます。
        </Text>
        {profile.data ? (
          <ProfileForm
            defaultValues={{
              handle: '',
              displayName: profile.data.displayName,
              bio: profile.data.bio,
            }}
            submitLabel="はじめる"
            onSubmit={onSubmit}
          />
        ) : profile.isError ? (
          <Text className="text-sm text-danger">{profile.error.message}</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    </Screen>
  );
}

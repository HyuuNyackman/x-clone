import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ProfileForm } from '@/features/profile/profile-form';
import { useProfile, useSaveProfile } from '@/features/profile/use-profile';

export default function ProfileScreen() {
  const profile = useProfile();
  const save = useSaveProfile();

  return (
    <Screen>
      <ScrollView contentContainerClassName="flex-grow justify-center gap-4 px-6 py-6">
        <Text className="text-3xl font-extrabold text-foreground">プロフィールを編集</Text>
        {profile.data ? (
          <View>
            <ProfileForm
              key={profile.data.id}
              defaultValues={{
                handle: profile.data.handle,
                displayName: profile.data.displayName,
                bio: profile.data.bio,
              }}
              submitLabel="保存する"
              onSubmit={save}
            />
          </View>
        ) : profile.isError ? (
          <Text className="text-sm text-danger">{profile.error.message}</Text>
        ) : (
          <ActivityIndicator />
        )}
      </ScrollView>
    </Screen>
  );
}

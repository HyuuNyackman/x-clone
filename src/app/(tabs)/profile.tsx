import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { compressImage, pickImage } from '@/features/media/image-processing';
import { ProfileForm } from '@/features/profile/profile-form';
import { useProfile, useSaveAvatar, useSaveProfile } from '@/features/profile/use-profile';

export default function ProfileScreen() {
  const profile = useProfile();
  const save = useSaveProfile();
  const saveAvatar = useSaveAvatar();
  const [avatarState, setAvatarState] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  const changeAvatar = async () => {
    setAvatarState({ busy: true, error: null });
    try {
      const picked = await pickImage();
      if (picked) await saveAvatar(await compressImage(picked, { targetBytes: 100 * 1024 }));
      setAvatarState({ busy: false, error: null });
    } catch (e) {
      setAvatarState({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerClassName="flex-grow justify-center gap-4 px-6 py-6">
        <Text className="text-3xl font-extrabold text-foreground">プロフィールを編集</Text>
        {profile.data ? (
          <View className="gap-4">
            <View className="items-center gap-2">
              <Avatar
                storageKey={profile.data.avatarUrl}
                name={profile.data.displayName}
                size={96}
              />
              <Button
                label={avatarState.busy ? 'アップロード中…' : 'アイコンを変更'}
                variant="outline"
                disabled={avatarState.busy}
                onPress={changeAvatar}
              />
              {avatarState.error ? (
                <Text className="text-sm text-danger">{avatarState.error}</Text>
              ) : null}
            </View>
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

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ProfileFieldError } from '@/features/profile/profile-api';
import { profileSchema, type ProfileValues } from '@/features/profile/schemas';

type ProfileFormProps = {
  defaultValues: ProfileValues;
  submitLabel: string;
  // 失敗したら例外を投げる。ProfileFieldError なら、その入力欄のエラーとして表示する。
  onSubmit: (values: ProfileValues) => Promise<void>;
};

export function ProfileForm({ defaultValues, submitLabel, onSubmit }: ProfileFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { control, handleSubmit, setError, formState } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    setSaved(false);
    try {
      await onSubmit(values);
      setSaved(true);
    } catch (e) {
      if (e instanceof ProfileFieldError) {
        setError(e.field, { message: e.message });
      } else {
        setSubmitError(e instanceof Error ? e.message : String(e));
      }
    }
  });

  return (
    <View className="gap-4">
      <TextField control={control} name="handle" label="ハンドル" />
      <TextField control={control} name="displayName" label="表示名" />
      <TextField control={control} name="bio" label="自己紹介" multiline />
      {submitError ? <Text className="text-sm text-danger">{submitError}</Text> : null}
      {saved ? <Text className="text-sm text-muted">保存しました</Text> : null}
      <Button
        label={formState.isSubmitting ? '保存中…' : submitLabel}
        disabled={formState.isSubmitting}
        onPress={submit}
      />
    </View>
  );
}

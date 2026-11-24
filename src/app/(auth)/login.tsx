import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { signIn } from '@/features/auth/auth-api';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';

export default function LoginScreen() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // 成功すると onAuthStateChange でセッションが入り、ルートガードがタブ画面へ移す。
  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signIn(values);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  });

  return (
    <Screen>
      <View className="flex-1 justify-center gap-4 px-6">
        <Text className="text-3xl font-extrabold text-foreground">ログイン</Text>
        <TextField
          control={control}
          name="email"
          label="メールアドレス"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          control={control}
          name="password"
          label="パスワード"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
        />
        {submitError ? <Text className="text-sm text-danger">{submitError}</Text> : null}
        <Button
          label={formState.isSubmitting ? 'ログイン中…' : 'ログイン'}
          disabled={formState.isSubmitting}
          onPress={onSubmit}
        />
        <Link href="/signup" className="text-center text-base text-primary">
          アカウントを作成する
        </Link>
      </View>
    </Screen>
  );
}

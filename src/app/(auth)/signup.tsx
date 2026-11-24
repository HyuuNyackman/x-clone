import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { signUp } from '@/features/auth/auth-api';
import { signupSchema, type SignupValues } from '@/features/auth/schemas';

export default function SignupScreen() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const { control, handleSubmit, formState } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  // メール確認が無効ならセッションが入り、ルートガードがタブ画面へ移す。有効なら確認待ちの案内を出す。
  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const result = await signUp(values);
      setNeedsConfirmation(result.needsConfirmation);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  });

  return (
    <Screen>
      <View className="flex-1 justify-center gap-4 px-6">
        <Text className="text-3xl font-extrabold text-foreground">アカウント作成</Text>
        {needsConfirmation ? (
          <Text className="text-base text-foreground">
            確認メールを送りました。メール内のリンクを開いてから、ログインしてください。
          </Text>
        ) : (
          <>
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
              label="パスワード (8文字以上)"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <TextField
              control={control}
              name="confirmPassword"
              label="パスワード (確認)"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={() => void onSubmit()}
            />
            {submitError ? <Text className="text-sm text-danger">{submitError}</Text> : null}
            <Button
              label={formState.isSubmitting ? '作成中…' : '登録する'}
              disabled={formState.isSubmitting}
              onPress={onSubmit}
            />
          </>
        )}
        <Link href="/login" className="text-center text-base text-primary">
          ログインへ戻る
        </Link>
      </View>
    </Screen>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useCreatePost } from '@/features/posts/use-posts';
import { POST_MAX_LENGTH, postSchema, type PostValues } from '@/features/posts/schemas';

// 投稿を作る画面 (モーダル)。投稿はタイムラインに先に反映され、裏で保存される。
export default function ComposeScreen() {
  const createPost = useCreatePost();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<PostValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { body: '' },
  });
  const body = useWatch({ control, name: 'body' });
  const remaining = POST_MAX_LENGTH - body.length;
  const canSubmit = body.trim().length > 0 && remaining >= 0;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const onSubmit = handleSubmit(async ({ body: text }) => {
    setError(null);
    try {
      await createPost.mutateAsync(text);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  });

  return (
    <Screen>
      <View className="gap-4 px-6 py-4">
        <Text className="text-xl font-extrabold text-foreground">新しい投稿</Text>
        <TextField control={control} name="body" label="本文" multiline />
        <Text
          accessibilityLabel="残り文字数"
          className={`text-right text-sm ${remaining < 0 ? 'text-danger' : 'text-muted'}`}
        >
          {remaining}
        </Text>
        {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        <Button label="投稿する" onPress={onSubmit} disabled={!canSubmit || createPost.isPending} />
        <Button label="キャンセル" variant="outline" onPress={close} />
      </View>
    </Screen>
  );
}

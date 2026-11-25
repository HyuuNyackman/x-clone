import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { compressImage, pickImage, type ProcessedImage } from '@/features/media/image-processing';
import { MAX_POST_IMAGES } from '@/features/posts/posts-api';
import { useCreatePost } from '@/features/posts/use-posts';
import { POST_MAX_LENGTH, postSchema, type PostValues } from '@/features/posts/schemas';

// 投稿を作る画面 (モーダル)。投稿はタイムラインに先に反映され、裏で保存される。
export default function ComposeScreen() {
  const createPost = useCreatePost();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const { control, handleSubmit } = useForm<PostValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { body: '' },
  });
  const body = useWatch({ control, name: 'body' });
  const remaining = POST_MAX_LENGTH - body.length;
  const canSubmit = body.trim().length > 0 && remaining >= 0;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const addImage = async () => {
    setError(null);
    setProcessing(true);
    try {
      const picked = await pickImage();
      if (picked) {
        const processed = await compressImage(picked);
        setImages((current) => [...current, processed].slice(0, MAX_POST_IMAGES));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  };

  const onSubmit = handleSubmit(async ({ body: text }) => {
    setError(null);
    try {
      await createPost.mutateAsync({ body: text, images });
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
        <View className="flex-row flex-wrap gap-2">
          {images.map((image, i) => (
            <Pressable
              key={image.uri}
              accessibilityRole="button"
              accessibilityLabel={`画像${i + 1}を外す`}
              onPress={() => setImages((current) => current.filter((_, j) => j !== i))}
            >
              <Image
                source={{ uri: image.uri }}
                style={{ width: 72, height: 72, borderRadius: 8 }}
              />
            </Pressable>
          ))}
        </View>
        {images.length < MAX_POST_IMAGES ? (
          <Button
            label={processing ? '画像を処理中…' : '画像を追加'}
            variant="outline"
            onPress={addImage}
            disabled={processing || createPost.isPending}
          />
        ) : null}
        {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        <Button
          label="投稿する"
          onPress={onSubmit}
          disabled={!canSubmit || createPost.isPending || processing}
        />
        <Button label="キャンセル" variant="outline" onPress={close} />
      </View>
    </Screen>
  );
}

import { View } from 'react-native';

import { RemoteImage } from '@/components/remote-image';
import type { PostMedia } from '@/features/posts/posts-api';

// 投稿の画像。1 枚は元の縦横比で、2 枚以上は 2 列の正方形で並べる。
export function PostImages({ media }: { media: PostMedia[] }) {
  if (media.length === 0) return null;
  if (media.length === 1) {
    const [m] = media;
    return (
      <RemoteImage
        bucket="post-media"
        storageKey={m.storageKey}
        accessibilityLabel="投稿の画像"
        contentFit="cover"
        style={{ width: '100%', aspectRatio: m.width / m.height, borderRadius: 12 }}
      />
    );
  }
  return (
    <View className="flex-row flex-wrap gap-1">
      {media.map((m) => (
        <RemoteImage
          key={m.storageKey}
          bucket="post-media"
          storageKey={m.storageKey}
          accessibilityLabel="投稿の画像"
          contentFit="cover"
          style={{ width: '49%', aspectRatio: 1, borderRadius: 8 }}
        />
      ))}
    </View>
  );
}

import { View } from 'react-native';

import { RemoteImage } from '@/components/remote-image';
import type { PostMedia } from '@/features/posts/posts-api';

// expo-image は Web で <img> を出すため、accessibilityLabel が aria-label にならない。
// ラベルは View に付け、画像はその中いっぱいに広げる。
function PostImage({
  m,
  style,
}: {
  m: PostMedia;
  style: { width: '100%' | '49%'; aspectRatio: number; borderRadius: number };
}) {
  return (
    <View accessibilityRole="image" accessibilityLabel="投稿の画像" style={style}>
      <RemoteImage
        bucket="post-media"
        storageKey={m.storageKey}
        alt="投稿の画像"
        contentFit="cover"
        style={{ width: '100%', height: '100%', borderRadius: style.borderRadius }}
      />
    </View>
  );
}

// 投稿の画像。1 枚は元の縦横比で、2 枚以上は 2 列の正方形で並べる。
export function PostImages({ media }: { media: PostMedia[] }) {
  if (media.length === 0) return null;
  if (media.length === 1) {
    const [m] = media;
    return (
      <PostImage
        m={m}
        style={{ width: '100%', aspectRatio: m.width / m.height, borderRadius: 12 }}
      />
    );
  }
  return (
    <View className="flex-row flex-wrap gap-1">
      {media.map((m) => (
        <PostImage
          key={m.storageKey}
          m={m}
          style={{ width: '49%', aspectRatio: 1, borderRadius: 8 }}
        />
      ))}
    </View>
  );
}

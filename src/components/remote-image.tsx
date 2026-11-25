import { Image } from 'expo-image';
import type { ComponentProps } from 'react';

import { mediaUrl, type MediaBucket } from '@/features/media/media-url';

type RemoteImageProps = Omit<ComponentProps<typeof Image>, 'source'> & {
  bucket: MediaBucket;
  storageKey: string;
};

// キーから表示 URL を組み立てて、expo-image (ディスクキャッシュ付き) で出す。
export function RemoteImage({ bucket, storageKey, ...props }: RemoteImageProps) {
  return (
    <Image
      source={{ uri: mediaUrl(bucket, storageKey) }}
      cachePolicy="disk"
      transition={150}
      {...props}
    />
  );
}

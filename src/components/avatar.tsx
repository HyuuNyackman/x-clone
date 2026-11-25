import { Text, View } from 'react-native';

import { RemoteImage } from '@/components/remote-image';

type AvatarProps = {
  // avatars バケットのキー。無ければ表示名の頭文字を出す。
  storageKey: string | null;
  name: string;
  size?: number;
};

export function Avatar({ storageKey, name, size = 48 }: AvatarProps) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (storageKey) {
    return (
      <RemoteImage
        bucket="avatars"
        storageKey={storageKey}
        accessibilityLabel={`${name}のアイコン`}
        style={style}
      />
    );
  }
  return (
    <View style={style} className="items-center justify-center bg-border">
      <Text className="font-bold text-foreground">{name.slice(0, 1)}</Text>
    </View>
  );
}

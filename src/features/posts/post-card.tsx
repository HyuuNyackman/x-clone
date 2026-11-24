import { Pressable, Text, View } from 'react-native';

import type { Post } from '@/features/posts/posts-api';

type PostCardProps = {
  post: Post;
  // 自分の投稿のときだけ、削除ボタンを出す。
  canDelete: boolean;
  onDelete: (postId: string) => void;
};

export function PostCard({ post, canDelete, onDelete }: PostCardProps) {
  return (
    <View className="gap-1 border-b border-border px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={1}>
          {post.author.displayName}
          <Text className="font-normal text-muted"> @{post.author.handle}</Text>
        </Text>
        {canDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="投稿を削除"
            onPress={() => onDelete(post.id)}
            hitSlop={8}
          >
            <Text className="text-sm text-danger">削除</Text>
          </Pressable>
        ) : null}
      </View>
      <Text className="text-base text-foreground">{post.body}</Text>
    </View>
  );
}

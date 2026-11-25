import { Pressable, Text, View } from 'react-native';

import type { Post } from '@/features/posts/posts-api';

type PostCardProps = {
  post: Post;
  // 自分の投稿のときだけ、削除ボタンを出す。
  canDelete: boolean;
  onDelete: (postId: string) => void;
  // 渡すと、カードを押して投稿詳細を開ける。
  onPress?: (postId: string) => void;
  // 渡すと、いいねボタンを出す。liked は押した後の状態 (いいね済みなら false = 取り消し)。
  onToggleLike?: (postId: string, liked: boolean) => void;
};

export function PostCard({ post, canDelete, onDelete, onPress, onToggleLike }: PostCardProps) {
  const content = (
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
      <View className="flex-row items-center gap-4">
        <Text accessibilityLabel="リプライ数" className="text-sm text-muted">
          返信 {post.replyCount}
        </Text>
        {onToggleLike ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={post.likedByMe ? 'いいねを取り消す' : 'いいね'}
            accessibilityState={{ selected: post.likedByMe }}
            onPress={() => onToggleLike(post.id, !post.likedByMe)}
            hitSlop={8}
          >
            <Text className={`text-sm ${post.likedByMe ? 'font-bold text-danger' : 'text-muted'}`}>
              {post.likedByMe ? '♥' : '♡'} {post.likeCount}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${post.author.displayName}の投稿を開く`}
      onPress={() => onPress(post.id)}
    >
      {content}
    </Pressable>
  );
}

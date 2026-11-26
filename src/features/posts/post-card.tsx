import { Pressable, Text, View } from 'react-native';

import { PostImages } from '@/features/posts/post-images';
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
  // 渡すと、ブックマークボタンを出す。bookmarked は今ブックマーク済みか。onToggleBookmark の第2引数は押した後の状態。
  bookmarked?: boolean;
  onToggleBookmark?: (postId: string, bookmarked: boolean) => void;
  // 渡すと、他人の投稿にフォロー・解除ボタンを出す。following は今フォロー中か。follow は押した後の状態。
  following?: boolean;
  // 渡すと、投稿者の名前を押してプロフィールを開ける。
  onPressAuthor?: (handle: string) => void;
  onToggleFollow?: (authorId: string, follow: boolean) => void;
};

export function PostCard({
  post,
  canDelete,
  onDelete,
  onPress,
  onToggleLike,
  bookmarked = false,
  onToggleBookmark,
  following = false,
  onPressAuthor,
  onToggleFollow,
}: PostCardProps) {
  const content = (
    <View className="gap-1 border-b border-border px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text
          className="flex-1 text-base font-bold text-foreground"
          numberOfLines={1}
          accessibilityRole={onPressAuthor ? 'link' : undefined}
          accessibilityLabel={
            onPressAuthor ? `@${post.author.handle} のプロフィールを開く` : undefined
          }
          onPress={onPressAuthor ? () => onPressAuthor(post.author.handle) : undefined}
        >
          {post.author.displayName}
          <Text className="font-normal text-muted"> @{post.author.handle}</Text>
        </Text>
        {onToggleFollow ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              following
                ? `@${post.author.handle} のフォローを解除`
                : `@${post.author.handle} をフォロー`
            }
            accessibilityState={{ selected: following }}
            onPress={() => onToggleFollow(post.authorId, !following)}
            hitSlop={8}
            className="ml-2"
          >
            <Text className={`text-sm ${following ? 'text-muted' : 'font-bold text-primary'}`}>
              {following ? 'フォロー中' : 'フォロー'}
            </Text>
          </Pressable>
        ) : null}
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
      <PostImages media={post.media} />
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
        {onToggleBookmark ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? 'ブックマークを解除' : 'ブックマーク'}
            accessibilityState={{ selected: bookmarked }}
            onPress={() => onToggleBookmark(post.id, !bookmarked)}
            hitSlop={8}
          >
            <Text className={`text-sm ${bookmarked ? 'font-bold text-primary' : 'text-muted'}`}>
              {bookmarked ? '★' : '☆'}
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

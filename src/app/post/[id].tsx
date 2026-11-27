import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FlatList, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useAuthStore } from '@/features/auth/auth-store';
import { PostCard } from '@/features/posts/post-card';
import { POST_MAX_LENGTH, postSchema, type PostValues } from '@/features/posts/schemas';
import {
  flattenTimeline,
  useBookmarkedIds,
  usePost,
  useReplies,
  useReplyToPost,
  useToggleBookmark,
  useToggleLike,
} from '@/features/posts/use-posts';

const noop = () => {};

// 投稿詳細画面。元の投稿とリプライ一覧を出し、ここからリプライできる。
export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = usePost(id);
  const replies = useReplies(id);
  const reply = useReplyToPost(id);
  const toggleLike = useToggleLike();
  const onToggleLike = (postId: string, liked: boolean) => toggleLike.mutate({ postId, liked });
  const userId = useAuthStore((state) => state.session?.user.id);
  const toggleBookmark = useToggleBookmark();
  const bookmarkedIds = useBookmarkedIds().data;
  const bookmarkedSet = useMemo(() => new Set(bookmarkedIds ?? []), [bookmarkedIds]);
  // 未ログインではブックマークのボタンを出さない。
  const onToggleBookmark = userId
    ? (postId: string, bookmarked: boolean) => toggleBookmark.mutate({ postId, bookmarked })
    : undefined;
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<PostValues>({
    resolver: zodResolver(postSchema),
    defaultValues: { body: '' },
  });
  const body = useWatch({ control, name: 'body' });
  const remaining = POST_MAX_LENGTH - body.length;
  const canSubmit = body.trim().length > 0 && remaining >= 0;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const onSubmit = handleSubmit(async ({ body: text }) => {
    setError(null);
    try {
      await reply.mutateAsync(text);
      reset({ body: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  });

  const loadError = post.error ?? replies.error;

  const header = (
    <View>
      {post.data ? (
        <PostCard
          post={post.data}
          canDelete={false}
          onDelete={noop}
          onToggleLike={onToggleLike}
          bookmarked={bookmarkedSet.has(post.data.id)}
          onToggleBookmark={onToggleBookmark}
        />
      ) : null}
      {!post.data && !post.isPending && !post.isError ? (
        <Text className="px-4 py-6 text-center text-muted">投稿が見つかりません</Text>
      ) : null}
      {loadError ? (
        <Text className="px-4 py-3 text-sm text-danger">{loadError.message}</Text>
      ) : null}
      {toggleBookmark.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{toggleBookmark.error.message}</Text>
      ) : null}
      {post.data ? (
        <View className="gap-3 border-b border-border px-4 py-3">
          <TextField control={control} name="body" label="返信" multiline />
          <Text
            accessibilityLabel="返信の残り文字数"
            className={`text-right text-sm ${remaining < 0 ? 'text-danger' : 'text-muted'}`}
          >
            {remaining}
          </Text>
          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
          <Button label="返信する" onPress={onSubmit} disabled={!canSubmit || reply.isPending} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Button label="戻る" variant="outline" onPress={back} />
        <Text className="text-xl font-extrabold text-foreground">投稿</Text>
      </View>
      <FlatList
        data={flattenTimeline(replies.data)}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        onEndReached={() => {
          if (replies.hasNextPage && !replies.isFetchingNextPage) void replies.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            canDelete={false}
            onDelete={noop}
            onToggleLike={item.id.startsWith('optimistic-') ? undefined : onToggleLike}
            bookmarked={bookmarkedSet.has(item.id)}
            onToggleBookmark={item.id.startsWith('optimistic-') ? undefined : onToggleBookmark}
            onPress={
              item.id.startsWith('optimistic-')
                ? undefined
                : (replyId) => router.push({ pathname: '/post/[id]', params: { id: replyId } })
            }
          />
        )}
        ListEmptyComponent={
          post.data ? (
            <Text className="px-4 py-6 text-center text-muted">
              {replies.isPending ? '読み込み中…' : 'まだリプライがありません'}
            </Text>
          ) : undefined
        }
      />
    </Screen>
  );
}

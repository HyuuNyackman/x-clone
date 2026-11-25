import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useAuthStore } from '@/features/auth/auth-store';
import { PostCard } from '@/features/posts/post-card';
import {
  flattenTimeline,
  useDeletePost,
  useFollowingIds,
  useTimeline,
  useToggleFollow,
  useToggleLike,
  type TimelineTab,
} from '@/features/posts/use-posts';
import { checkSupabaseConnection } from '@/lib/supabase-health';

const TABS: { key: TimelineTab; label: string }[] = [
  { key: 'recommended', label: 'おすすめ' },
  { key: 'following', label: 'フォロー中' },
];

export default function HomeScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [tab, setTab] = useState<TimelineTab>('recommended');
  const timeline = useTimeline(tab);
  const deletePost = useDeletePost();
  const toggleLike = useToggleLike();
  const toggleFollow = useToggleFollow();
  const followingIds = useFollowingIds().data;
  const followingSet = useMemo(() => new Set(followingIds ?? []), [followingIds]);
  const posts = useMemo(() => flattenTimeline(timeline.data), [timeline.data]);

  const connection = useQuery({
    queryKey: ['supabase', 'connection'],
    queryFn: checkSupabaseConnection,
  });
  const status = connection.isPending
    ? '確認中…'
    : connection.data?.ok
      ? '接続OK'
      : `接続NG: ${connection.data?.message ?? connection.error?.message}`;

  return (
    <Screen>
      <View className="gap-3 border-b border-border px-4 py-3">
        <Text className="text-xl font-extrabold text-foreground">ホーム</Text>
        <Text className="text-xs text-muted">データベース: {status}</Text>
        <Button label="投稿を作成" onPress={() => router.push('/compose')} />
      </View>
      <View accessibilityRole="tablist" className="flex-row border-b border-border">
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            className="flex-1 items-center py-3"
          >
            <Text className={tab === key ? 'font-bold text-foreground' : 'text-muted'}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {timeline.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{timeline.error.message}</Text>
      ) : null}
      {toggleLike.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{toggleLike.error.message}</Text>
      ) : null}
      {toggleFollow.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{toggleFollow.error.message}</Text>
      ) : null}
      {deletePost.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{deletePost.error.message}</Text>
      ) : null}
      <FlashList
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            canDelete={item.authorId === userId && !item.id.startsWith('optimistic-')}
            onDelete={(id) => deletePost.mutate(id)}
            onToggleLike={
              item.id.startsWith('optimistic-')
                ? undefined
                : (postId, liked) => toggleLike.mutate({ postId, liked })
            }
            onPressAuthor={(handle) =>
              router.push({ pathname: '/user/[handle]', params: { handle } })
            }
            following={followingSet.has(item.authorId)}
            onToggleFollow={
              item.authorId === userId || item.id.startsWith('optimistic-')
                ? undefined
                : (targetId, follow) => toggleFollow.mutate({ targetId, follow })
            }
            onPress={
              item.id.startsWith('optimistic-')
                ? undefined
                : (id) => router.push({ pathname: '/post/[id]', params: { id } })
            }
          />
        )}
        onEndReached={() => {
          if (timeline.hasNextPage && !timeline.isFetchingNextPage) void timeline.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshing={timeline.isRefetching && !timeline.isFetchingNextPage}
        onRefresh={() => void timeline.refetch()}
        ListFooterComponent={
          timeline.isFetchingNextPage ? (
            <Text className="px-4 py-3 text-center text-muted">読み込み中…</Text>
          ) : null
        }
        ListEmptyComponent={
          <Text className="px-4 py-6 text-center text-muted">
            {timeline.isPending
              ? '読み込み中…'
              : tab === 'following'
                ? 'フォロー中の人の投稿はまだありません'
                : 'まだ投稿がありません'}
          </Text>
        }
      />
    </Screen>
  );
}

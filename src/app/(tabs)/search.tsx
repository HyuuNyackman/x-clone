import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Screen } from '@/components/screen';
import { useAuthStore } from '@/features/auth/auth-store';
import { PostCard } from '@/features/posts/post-card';
import { flattenTimeline, useDeletePost, useToggleLike } from '@/features/posts/use-posts';
import {
  normalizeQuery,
  useDebouncedValue,
  useSearchPosts,
  useSearchUsers,
} from '@/features/search/use-search';

type SearchTab = 'posts' | 'users';

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'posts', label: '投稿' },
  { key: 'users', label: 'ユーザー' },
];

export default function SearchScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<SearchTab>('posts');
  const query = normalizeQuery(useDebouncedValue(text));
  const posts = useSearchPosts(query);
  const users = useSearchUsers(query);
  const toggleLike = useToggleLike();
  const deletePost = useDeletePost();
  const postList = useMemo(() => flattenTimeline(posts.data), [posts.data]);

  const active = tab === 'posts' ? posts : users;
  const emptyMessage =
    query.length === 0
      ? 'キーワードを入力してください'
      : active.isPending
        ? '検索中…'
        : '見つかりませんでした';

  return (
    <Screen>
      <View className="gap-3 border-b border-border px-4 py-3">
        <Text className="text-xl font-extrabold text-foreground">検索</Text>
        <TextInput
          accessibilityLabel="検索キーワード"
          placeholder="キーワードで検索"
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          className="rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground"
        />
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
      {active.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{active.error.message}</Text>
      ) : null}
      {toggleLike.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{toggleLike.error.message}</Text>
      ) : null}
      {tab === 'posts' ? (
        <FlashList
          data={query.length > 0 ? postList : []}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              canDelete={item.authorId === userId}
              onDelete={(id) => deletePost.mutate(id)}
              onToggleLike={(postId, liked) => toggleLike.mutate({ postId, liked })}
              onPressAuthor={(handle) =>
                router.push({ pathname: '/user/[handle]', params: { handle } })
              }
              onPress={(id) => router.push({ pathname: '/post/[id]', params: { id } })}
            />
          )}
          onEndReached={() => {
            if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <Text className="px-4 py-6 text-center text-muted">{emptyMessage}</Text>
          }
        />
      ) : (
        <FlashList
          data={query.length > 0 ? (users.data ?? []) : []}
          keyExtractor={(user) => user.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`@${item.handle} のプロフィールを開く`}
              onPress={() =>
                router.push({ pathname: '/user/[handle]', params: { handle: item.handle } })
              }
              className="flex-row items-center gap-3 border-b border-border px-4 py-3"
            >
              <Avatar storageKey={item.avatarUrl} name={item.displayName} size={48} />
              <View className="flex-1">
                <Text className="text-base font-bold text-foreground" numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text className="text-sm text-muted" numberOfLines={1}>
                  @{item.handle}
                </Text>
                {item.bio ? (
                  <Text className="text-sm text-foreground" numberOfLines={2}>
                    {item.bio}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text className="px-4 py-6 text-center text-muted">{emptyMessage}</Text>
          }
        />
      )}
    </Screen>
  );
}

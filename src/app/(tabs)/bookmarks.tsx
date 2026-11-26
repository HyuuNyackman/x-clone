import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { PostCard } from '@/features/posts/post-card';
import { useBookmarks, useToggleBookmark } from '@/features/posts/use-posts';

// 自分のブックマーク一覧。解除すると、取り直しのあとで一覧から消える。
export default function BookmarksScreen() {
  const bookmarks = useBookmarks();
  const toggleBookmark = useToggleBookmark();

  return (
    <Screen>
      <View className="border-b border-border px-4 py-3">
        <Text className="text-xl font-extrabold text-foreground">ブックマーク</Text>
      </View>
      {bookmarks.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{bookmarks.error.message}</Text>
      ) : null}
      {toggleBookmark.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{toggleBookmark.error.message}</Text>
      ) : null}
      <FlashList
        data={bookmarks.data ?? []}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            canDelete={false}
            onDelete={() => {}}
            bookmarked
            onToggleBookmark={(postId, bookmarked) => toggleBookmark.mutate({ postId, bookmarked })}
            onPressAuthor={(handle) =>
              router.push({ pathname: '/user/[handle]', params: { handle } })
            }
            onPress={(id) => router.push({ pathname: '/post/[id]', params: { id } })}
          />
        )}
        refreshing={bookmarks.isRefetching}
        onRefresh={() => void bookmarks.refetch()}
        ListEmptyComponent={
          <Text className="px-4 py-6 text-center text-muted">
            {bookmarks.isPending ? '読み込み中…' : 'ブックマークはまだありません'}
          </Text>
        }
      />
    </Screen>
  );
}

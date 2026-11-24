import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useAuthStore } from '@/features/auth/auth-store';
import { PostCard } from '@/features/posts/post-card';
import { useDeletePost, useTimeline } from '@/features/posts/use-posts';
import { checkSupabaseConnection } from '@/lib/supabase-health';

export default function HomeScreen() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const timeline = useTimeline();
  const deletePost = useDeletePost();

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
      {timeline.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{timeline.error.message}</Text>
      ) : null}
      {deletePost.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{deletePost.error.message}</Text>
      ) : null}
      <FlatList
        data={timeline.data ?? []}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            canDelete={item.authorId === userId && !item.id.startsWith('optimistic-')}
            onDelete={(id) => deletePost.mutate(id)}
          />
        )}
        ListEmptyComponent={
          <Text className="px-4 py-6 text-center text-muted">
            {timeline.isPending ? '読み込み中…' : 'まだ投稿がありません'}
          </Text>
        }
      />
    </Screen>
  );
}

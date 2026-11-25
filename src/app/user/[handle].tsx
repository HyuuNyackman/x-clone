import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useAuthStore } from '@/features/auth/auth-store';
import { PostCard } from '@/features/posts/post-card';
import {
  useFollowingIds,
  useToggleFollow,
  useToggleLike,
  useUserPosts,
} from '@/features/posts/use-posts';
import { useFollowCounts, useProfileByHandle } from '@/features/profile/use-profile';

const noop = () => {};

// 他ユーザー (または自分) のプロフィール画面。handle で開く。
export default function UserProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const myId = useAuthStore((state) => state.session?.user.id);
  const profile = useProfileByHandle(handle);
  const user = profile.data ?? undefined;
  const counts = useFollowCounts(user?.id);
  const posts = useUserPosts(user?.id);
  const followingIds = useFollowingIds().data;
  const toggleFollow = useToggleFollow();
  const toggleLike = useToggleLike();
  const following = useMemo(
    () => (user ? (followingIds ?? []).includes(user.id) : false),
    [followingIds, user],
  );
  const isMe = user !== undefined && user.id === myId;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const header = (
    <View>
      {user ? (
        <View className="gap-3 border-b border-border px-4 py-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-2xl font-extrabold text-foreground">{user.displayName}</Text>
              <Text className="text-base text-muted">@{user.handle}</Text>
            </View>
            {isMe ? (
              <Button
                label="プロフィールを編集"
                variant="outline"
                onPress={() => router.push('/profile')}
              />
            ) : (
              <Button
                label={following ? 'フォロー中' : 'フォロー'}
                variant={following ? 'outline' : 'primary'}
                onPress={() => toggleFollow.mutate({ targetId: user.id, follow: !following })}
              />
            )}
          </View>
          {user.bio ? <Text className="text-base text-foreground">{user.bio}</Text> : null}
          <View className="flex-row gap-4">
            <Text accessibilityLabel="フォロー数" className="text-sm text-muted">
              <Text className="font-bold text-foreground">{counts.data?.following ?? '-'}</Text>{' '}
              フォロー中
            </Text>
            <Text accessibilityLabel="フォロワー数" className="text-sm text-muted">
              <Text className="font-bold text-foreground">{counts.data?.followers ?? '-'}</Text>{' '}
              フォロワー
            </Text>
          </View>
        </View>
      ) : null}
      {profile.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{profile.error.message}</Text>
      ) : null}
      {!user && !profile.isPending && !profile.isError ? (
        <Text className="px-4 py-6 text-center text-muted">ユーザーが見つかりません</Text>
      ) : null}
      {counts.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{counts.error.message}</Text>
      ) : null}
      {posts.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{posts.error.message}</Text>
      ) : null}
      {toggleFollow.isError ? (
        <Text className="px-4 py-3 text-sm text-danger">{toggleFollow.error.message}</Text>
      ) : null}
      {user ? (
        <View accessibilityRole="tablist" className="flex-row border-b border-border">
          <View
            accessibilityRole="tab"
            accessibilityLabel="投稿"
            accessibilityState={{ selected: true }}
            className="flex-1 items-center py-3"
          >
            <Text className="font-bold text-foreground">投稿</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Button label="戻る" variant="outline" onPress={back} />
        <Text className="text-xl font-extrabold text-foreground">プロフィール</Text>
      </View>
      <FlatList
        data={posts.data ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            canDelete={false}
            onDelete={noop}
            onToggleLike={(postId, liked) => toggleLike.mutate({ postId, liked })}
            onPress={(id) => router.push({ pathname: '/post/[id]', params: { id } })}
          />
        )}
        ListEmptyComponent={
          user ? (
            <Text className="px-4 py-6 text-center text-muted">
              {posts.isPending ? '読み込み中…' : 'まだ投稿がありません'}
            </Text>
          ) : undefined
        }
      />
    </Screen>
  );
}

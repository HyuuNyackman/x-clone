import { Redirect } from 'expo-router';

import { useAuthStore } from '@/features/auth/auth-store';

// `/` はログイン状態に関わらず必ず存在する入口。
// `(tabs)` と `(auth)` はガードで片方しか有効にならないため、`/` をどちらかのグループに置くと、
// もう一方の状態で開いたとき Unmatched Route になる。ここで状態に応じた画面へ振り分ける。
export default function Index() {
  const isLoggedIn = useAuthStore((state) => state.session !== null);
  return <Redirect href={isLoggedIn ? '/home' : '/login'} />;
}

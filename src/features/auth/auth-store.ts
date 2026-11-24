import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  // 保存済みセッションの読み込みが終わったか。終わるまでガードは遷移を決めない。
  initialized: boolean;
};

export const useAuthStore = create<AuthState>(() => ({ session: null, initialized: false }));

// セッションの変化 (ログイン・ログアウト・トークン更新) をストアへ反映する。アプリ起動時に1回だけ呼ぶ。
export function startAuthListener() {
  void supabase.auth
    .getSession()
    .then(({ data }) => useAuthStore.setState({ session: data.session, initialized: true }))
    .catch(() => useAuthStore.setState({ session: null, initialized: true }));

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, initialized: true });
  });
  return () => data.subscription.unsubscribe();
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY を .env に設定してください (.env.example を参照)。',
  );
}

// アプリに入れてよいのは publishable キー (旧 anon キー) だけ。service_role キーは入れない。データは RLS で守る。
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // セッションは AsyncStorage に保存する (Expo Go に同梱。Web では localStorage になる)。
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // URL からセッションを読むのは Web のリダイレクト型ログインだけ。ネイティブには URL がない。
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// トークンの自動更新は、アプリが前面にいる間だけ動かす。
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を .env に設定してください (.env.example を参照)。',
  );
}

// アプリに入れてよいのは anon キーだけ。service_role キーは入れない。データは RLS で守る。
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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

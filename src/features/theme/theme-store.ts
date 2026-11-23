import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

// クライアント側だけの状態 (UI の設定) を Zustand で持つ。サーバー由来のデータは TanStack Query に置く。
// 永続化 (AsyncStorage) は設定画面を作るときに追加する。
export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference: (preference) => set({ preference }),
}));

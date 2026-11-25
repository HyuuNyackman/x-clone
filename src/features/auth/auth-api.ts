import type { LoginValues, SignupValues } from '@/features/auth/schemas';
import { supabase } from '@/lib/supabase';

// Supabase のエラーを画面に出す日本語へ変換する。
export function toAuthMessage(error: { code?: string; message: string }): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'メールアドレスまたはパスワードが正しくありません';
    case 'email_not_confirmed':
      return 'メールアドレスの確認が済んでいません。届いたメールのリンクを開いてください';
    case 'user_already_exists':
    case 'email_exists':
      return 'このメールアドレスは既に登録されています';
    case 'weak_password':
      return 'パスワードが弱すぎます。別のパスワードにしてください';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return '試行が多すぎます。しばらくしてからやり直してください';
    default:
      return `エラーが発生しました: ${error.message}`;
  }
}

export async function signIn({ email, password }: LoginValues) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(toAuthMessage(error));
}

// メール確認が有効なプロジェクトでは session が null で返る。その場合は確認待ちとして扱う。
export async function signUp({
  email,
  password,
}: SignupValues): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(toAuthMessage(error));
  return { needsConfirmation: data.session === null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(toAuthMessage(error));
}

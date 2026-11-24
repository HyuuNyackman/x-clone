import { supabase } from '@/lib/supabase';

export type ConnectionResult = { ok: true } | { ok: false; message: string };

// PostgREST が「テーブルが見つからない」と返すときのコード。
const TABLE_NOT_FOUND = 'PGRST205';

// 接続確認用の簡単なクエリ。まだテーブルがないので、存在しないテーブルを引く。
// API が応答し、キーが受理され、テーブル未定義のエラーが返れば、接続できているとみなす。
// URL やキーが誤っていれば、別のエラーか通信エラーになる。テーブルを作ったら、実テーブルの head クエリに置き換える。
export async function checkSupabaseConnection(): Promise<ConnectionResult> {
  try {
    const { error } = await supabase.from('_connection_check').select('*').limit(1);
    if (!error || error.code === TABLE_NOT_FOUND) {
      return { ok: true };
    }
    return { ok: false, message: `${error.code ?? 'error'}: ${error.message}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

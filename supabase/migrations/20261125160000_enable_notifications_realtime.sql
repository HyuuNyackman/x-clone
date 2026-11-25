-- notifications の INSERT を Realtime で配信する (XCL-61)。
-- Realtime は通知だけに使う。タイムライン系のテーブルは publication に入れない。
-- postgres_changes は RLS に従うので、本人宛ての行だけが届く。
alter publication supabase_realtime add table public.notifications;

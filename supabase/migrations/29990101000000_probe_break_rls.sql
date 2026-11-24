-- XCL-88 の確認用 (マージしない): 更新のポリシーを、誰の行でも更新できる形に緩める。
drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (true) with check (true);

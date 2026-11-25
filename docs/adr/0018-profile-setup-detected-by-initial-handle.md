# ADR-0018: プロフィールの初回設定は、初期 handle のままかどうかで判定する

**Date**: 2026-11-24
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

サインアップ時に、トリガーが `profiles` を自動作成する。初期 handle は `user_` + uuid の先頭10桁で、あとからユーザーが変更する ([ADR-0012](0012-profiles-rls-and-signup-trigger.md))。
初回ログイン後に handle と表示名を決める画面を出すには、「初回設定が済んだか」を知る必要がある。

## Decision

handle が初期 handle (`user_` + `id` の先頭10桁) のままなら、初回設定が未了と判定する。
未了のあいだは、タブ画面 (`(tabs)/_layout.tsx`) が `/profile-setup` へ移す。設定画面では、初期 handle のままの保存を拒否し、設定が終わらないループを防ぐ。
DB のスキーマは変えない。

## Alternatives Considered

### Alternative 1: `profiles` に `onboarded_at` 列を足す

- **Pros**: 判定が明示的で、handle の規則に依存しない。
- **Cons**: マイグレーション、GRANT、pgTAP の更新が要る。クライアントが列を更新できるので、改ざんも考えることになる。
- **Why not**: 今は判定のためだけに、スキーマを広げる価値が低いため。

## Consequences

### Positive

- マイグレーションが要らない。

### Negative

- 判定が、トリガーの初期 handle の作り方に依存する。クライアントの `initialHandleFor` とトリガーを揃え続ける必要がある。

### Risks

- トリガーの初期 handle の規則を変えると、クライアントの判定が外れる。変えるときは `initialHandleFor` も直す。
- 他の人が、他人の初期 handle を先に取ることはできる (形式上は有効)。その場合、本人の初回設定は未了のままになるが、本人はどの handle にも変更できる。

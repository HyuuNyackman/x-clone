#!/usr/bin/env bash
# ブランチ保護とリポジトリの自動マージ設定を適用する (ADR-0016)。何度実行しても同じ結果になる。
#
#   scripts/ci/apply-branch-protection.sh [owner/repo]
#
# リポジトリの管理者権限がある gh でログインして、手元で実行する (CI からは実行しない)。
# 設定の中身を変えるときは、このスクリプトを直して、再実行する。
set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

# マージの必須チェック。名前は、PR のチェック一覧に出る表記。
# db-test は、supabase/ に変更がないときはスキップされる。スキップは成功として扱われる。
checks='["check / check", "e2e / e2e", "db-test / db-test", "claude-review"]'

# develop: 必須チェックが通れば、マージできる。
#   - 承認は 0 人 (一人運用で、自分の PR は承認できない)。
#   - 管理者は、必須チェックを迂回できる。ワークフローのファイルを変える PR は、Claude のレビューがスキップされる
#     (claude-code-action の仕様) ので、チェックが赤くなる。その場合に、オーナーが確認してマージするための逃げ道。
# main: 本番への反映の入口。管理者にも強制する。承認は 0 人 (一人運用で、リリース PR を自分でマージするため)。
protect() {
  local branch="$1" enforce_admins="$2"
  gh api -X PUT "repos/$repo/branches/$branch/protection" --input - <<JSON >/dev/null
{
  "required_status_checks": { "strict": false, "contexts": $checks },
  "enforce_admins": $enforce_admins,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
  echo "保護を適用した: $branch (管理者にも強制: $enforce_admins)"
}

protect develop false
protect main true

# 自動マージを許可し、マージ後にブランチを消す。
gh api -X PATCH "repos/$repo" -F allow_auto_merge=true -F delete_branch_on_merge=true >/dev/null
echo "自動マージを許可した"

#!/usr/bin/env bash
# 環境別の設定差分（config.<env>.toml）をベースの config.toml に結合する。
#
# なぜ必要か:
#   Supabase CLI は `supabase/config.toml` という固定名しか読まず、include 機構もない。
#   ローカル用のベースと stg / prod の差分を別ファイルで管理するため、
#   `supabase config push` の直前にこのスクリプトで 1 ファイルに結合する。
#
# 使い方:
#   supabase/scripts/build-remote-config.sh staging      # config.staging.toml を結合
#   supabase/scripts/build-remote-config.sh production   # config.production.toml を結合
#
#   結合後の config.toml はコミットしない（CI の checkout は使い捨て）。
#   ローカルで実行した場合は `git checkout supabase/config.toml` で元に戻す。
set -euo pipefail

usage() {
    echo "usage: $0 <staging|production>" >&2
    exit 2
}

[[ $# -eq 1 ]] || usage
env_name="$1"
case "$env_name" in
    staging | production) ;;
    *) usage ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
supabase_dir="$(dirname "$script_dir")"
base_config="$supabase_dir/config.toml"
env_config="$supabase_dir/config.$env_name.toml"

[[ -f "$env_config" ]] || {
    echo "error: $env_config が見つかりません" >&2
    exit 1
}

# 二重結合の防止（同じ checkout で 2 回実行すると [remotes.*] が重複してパースエラーになる）
if grep -q '^\[remotes\.' "$base_config"; then
    echo "error: $base_config に既に [remotes.*] が含まれています。git checkout で元に戻してから再実行してください" >&2
    exit 1
fi

# 未記入のプレースホルダが残っていたら止める（誤った URL / Reference ID をリモートへ反映しない）。
# コメント行（# より後）の言及は無視し、値として残っているものだけを検出する
if grep -nE '^[^#]*REPLACE_ME_' "$env_config"; then
    echo "error: $env_config に未記入のプレースホルダ（REPLACE_ME_）が残っています" >&2
    exit 1
fi

{
    printf '\n# ---- 以下は %s によって %s から結合された環境差分（コミットしない） ----\n' "$(basename "$0")" "$(basename "$env_config")"
    cat "$env_config"
} >>"$base_config"

echo "merged: $(basename "$env_config") -> supabase/config.toml"

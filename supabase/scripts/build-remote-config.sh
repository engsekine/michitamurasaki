#!/usr/bin/env bash
# 環境別の設定差分（config.<env>.toml）をベースの config.toml にマージし、
# `supabase config push` がそのまま読めるフラットな config.toml を生成する。
#
# なぜ必要か:
#   Supabase CLI は `supabase/config.toml` という固定名しか読まず、include 機構もない。
#   さらに `config push` は `[remotes.*]` ブロックを含む config を拒否するため、
#   差分を追記するのではなく、ベースの該当セクションのキーを置き換える形で 1 ファイルに結合する
#   （実際のマージは merge-remote-config.py が行う）。
#
# 使い方:
#   supabase/scripts/build-remote-config.sh staging [<project_ref>]      # config.staging.toml を結合
#   supabase/scripts/build-remote-config.sh production [<project_ref>]   # config.production.toml を結合
#
#   <project_ref> を渡すと、差分ファイルの project_id と一致するか検証する（別環境の差分を誤って push しない）。
#   結合後の config.toml はコミットしない（CI の checkout は使い捨て）。
#   ローカルで実行した場合は `git checkout supabase/config.toml` で元に戻す。
set -euo pipefail

usage() {
    echo "usage: $0 <staging|production> [<project_ref>]" >&2
    exit 2
}

[[ $# -eq 1 || $# -eq 2 ]] || usage
env_name="$1"
expected_ref="${2:-}"
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

# 未記入のプレースホルダが残っていたら止める（誤った URL / Reference ID をリモートへ反映しない）。
# コメント行（# より後）の言及は無視し、値として残っているものだけを検出する
if grep -nE '^[^#]*REPLACE_ME_' "$env_config"; then
    echo "error: $env_config に未記入のプレースホルダ（REPLACE_ME_）が残っています" >&2
    exit 1
fi

python3 "$script_dir/merge-remote-config.py" "$base_config" "$env_config" "$env_name" $expected_ref

# 結合結果に [remotes.*] が残っていたら config push が拒否するので念のため検査する
if grep -qE '^\[remotes\.' "$base_config"; then
    echo "error: 結合後の config.toml に [remotes.*] が残っています" >&2
    exit 1
fi

#!/bin/bash
# E2E spec（e2e/**/<name>/<name>.spec.ts）の編集を検知し、同フォルダの changelog.md / spec.md の更新を促す

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

# Edit / Write 両方を対象（新規作成時も 3 点セットを揃えてもらう）
if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" ]]; then
    exit 0
fi

# e2e ワークスペース配下の spec のみ
if [[ ! "$FILE_PATH" =~ /e2e/(service-front|admin-front)/.+\.spec\.ts$ ]]; then
    exit 0
fi

DIR=$(dirname "$FILE_PATH")
NAME=$(basename "$FILE_PATH" .spec.ts)

# 1 テスト 1 フォルダ（<name>/<name>.spec.ts）になっていない場合はその旨を伝える
if [[ "$(basename "$DIR")" != "$NAME" ]]; then
    echo "💡 E2E spec '$FILE_PATH' はフォルダ構成（<name>/<name>.spec.ts + spec.md + changelog.md）に沿っていません。" >&2
    echo "   e2e/README.md の「フォルダ構成と変更管理」に従って配置してください。" >&2
    exit 0
fi

MISSING=()
for doc in spec.md changelog.md; do
    if [[ ! -f "$DIR/$doc" ]]; then
        MISSING+=("$DIR/$doc")
    fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo "💡 E2E spec '$FILE_PATH' に対して以下が未作成です。同フォルダに作成してください:" >&2
    for f in "${MISSING[@]}"; do
        echo "   - $f" >&2
    done
    exit 0
fi

# リマインダー出力（stderr に書くと system-reminder として Claude に渡る）
echo "💡 E2E spec '$FILE_PATH' が編集されました。同じコミットで以下を更新してください:" >&2
echo "   - $DIR/changelog.md に 1 行追加（- YYYY-MM-DD <種別>: <内容>（<関連 spec / PR / commit>））" >&2
echo "   - シナリオ・前提が変わった場合は $DIR/spec.md も同期" >&2

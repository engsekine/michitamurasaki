---
name: pkg-update
description: 指定ブランチの package.json パッケージバージョンをアップデートします。
user-invocable: true
argument-hint: "[ブランチ名]"
---

指定ブランチの package.json パッケージバージョンをアップデートします。

## 使い方

```
/pkg-update $ARGUMENTS
```

例:
- `/pkg-update feature/my-feature` — 指定ブランチに切り替えてアップデート
- `/pkg-update` — 現在のブランチでアップデート

## $ARGUMENTS

対象ブランチ名（省略時は現在のブランチ）

## 手順

### 1. 作業ツリーの確認とブランチの切り替え

引数がある場合、切り替え前に未コミット変更がないか確認する:

```bash
git status --porcelain
```

出力がある場合は「未コミットの変更があります。コミットまたは stash してから再実行してください」と出力して終了する（自動 stash・自動コミットはしない）。

クリーンであれば切り替える:

```bash
git checkout $ARGUMENTS
```

ブランチが存在しない場合は「ブランチが見つかりません: $ARGUMENTS」と出力して終了。

### 2. 最新状態に同期

```bash
git pull origin $(git branch --show-current)
```

### 3. パッケージマネージャーの検出

以下の順で検出する:

| ファイル | コマンド |
|---------|---------|
| `package.json` + `pnpm-lock.yaml` | `pnpm` |
| `package.json` + `yarn.lock` | `yarn` |
| `package.json` | `npm` |

`package.json` が存在しない場合は「package.json が見つかりません」と出力して終了。

### 4. 更新前の状態記録

更新後の「旧 → 新バージョン」報告に使うため、更新前に古いパッケージ一覧を記録する:

```bash
npm outdated --workspaces --include-workspace-root   # npm の場合
```

（pnpm は `pnpm outdated -r`、yarn は `yarn outdated`）

### 5. アップデート実行

ルートの `package.json` に `workspaces` がある場合はモノレポとして扱う。ルートで実行するとワークスペース全体が更新されることを認識し、特定ワークスペースのみ更新したい指示があれば `--workspace <name>` を付ける。

**npm**:
```bash
npm update                        # 全ワークスペース
npm update --workspace <name>     # 特定ワークスペースのみ
npm audit fix
```

**pnpm**:
```bash
pnpm update -r
pnpm audit --fix
```

**yarn**:
```bash
yarn upgrade
```

### 6. 変更確認

```bash
git diff --stat
```

アップデートによる差分がある場合は内容を表示する。更新されたパッケージの旧→新バージョンは、手順4の記録と lockfile の差分から抽出する。

### 7. 検証

アップデート後に必ず実行し、結果を報告する（失敗しても勝手に revert しない。失敗内容を提示してユーザーに判断を仰ぐ）:

```bash
npm run type-check --workspaces --if-present
npm run check --workspaces --if-present
npm run test --workspaces --if-present
```

`validate` スクリプトを持つワークスペースは `npm run validate --workspace <name>` でまとめて実行してもよい。

### 8. 完了報告

```
アップデート完了
═══════════════════════════
ブランチ: <ブランチ名>
パッケージマネージャー: <npm/pnpm/yarn>

更新されたパッケージ:
- <パッケージ名>: <旧バージョン> → <新バージョン>
...

検証結果:
- type-check: <パス / 失敗（内容）>
- biome check: <パス / 失敗（内容）>
- test: <パス / 失敗（内容）>

次のステップ:
  動作確認後 /summary でPR説明文を作成できます
```

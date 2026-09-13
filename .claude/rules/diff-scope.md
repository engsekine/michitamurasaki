# 変更差分の収集規約（diff-scope）

スキル（`/review` `/check-typo` `/check-diff-impact` `/code-fix` `/sync-spec` `/summary` `/reply-review` 等）が「現在のブランチの変更差分」を扱うときの共通規約。各スキルはこのファイルを参照し、差分取得ロジックを個別に再定義しない。

## ベースブランチの検出

引数でベースブランチが指定されない場合、以下の順で検出する:

1. 上流ブランチ: `git rev-parse --abbrev-ref @{u}`（取得できればそれを使用）
2. `main` からの派生点: `git merge-base main HEAD` が成功すれば `main`
3. `develop` からの派生点（`main` が存在しない場合）
4. デフォルト: `main`

現在のブランチ自身が `main` / `develop` の場合は「コミット済みの変更」を持たないものとして扱い、未コミット差分のみを対象とする。

## 対象範囲（3 層の統合）

「変更差分」は以下 3 層の**和集合**とする。特定の層のみを対象とするスキル（例: `/create-commit-message` はステージング済み優先、`/summary` はコミット済みのみ）は、その旨をスキル側に明記する。

| 層 | ファイル一覧 | 差分詳細 |
|---|---|---|
| 未ステージ | `git diff --name-only` | `git diff` |
| ステージング済み | `git diff --cached --name-only` | `git diff --cached` |
| コミット済み | `git diff <ベース>...HEAD --name-only` | `git diff <ベース>...HEAD` |

ファイル一覧は 3 層を統合して重複排除する。3 層すべてが空なら「変更差分がありません」と出力して終了する。

## 除外 pathspec

以下は全スキル共通でチェック対象外とする:

```bash
git diff -- ':!package-lock.json' ':!yarn.lock' ':!pnpm-lock.yaml' ':!node_modules' ':!dist' ':!build' ':!.next'
```

- バイナリファイル（画像・フォント等）も対象外
- lockfile の差分を意図的に見るスキル（`/pkg-update` の更新バージョン抽出等）は例外として明記する

## モノレポのパスプレフィックス

このリポジトリは npm workspaces のモノレポ。`src/...` で始まる相対パターンを扱うスキルは、以下のプレフィックスを除いた相対パスとして照合する:

| ワークスペース | 内容 | dev サーバー |
|---|---|---|
| `service-front/` | ユーザー向け Next.js アプリ | `http://localhost:3000` |
| `admin-front/` | 管理画面 Next.js アプリ | `http://localhost:3001` |
| `packages/<name>/` | 共有パッケージ | — |

import の逆引き検索は必ず両アプリのルート（`service-front/src/`・`admin-front/src/`）を対象に含める。

## import 逆引きの方法

フォルダ構成規約（`rules/folder-structure.md`）により、外部からの import は `index.ts` 経由（例: `@/shared/lib/resource`）となる。逆引きは**ファイル名ではなく親フォルダ名（バレル名）で検索する**:

- 検索キーワード: 変更ファイルの親フォルダ名（`Foo/Foo.tsx` → `Foo`、`resource/errors.ts` → `resource`）
- 検索パターン: `from ['"].*/(バレル名)['"]`（`*.ts` / `*.tsx` 対象、Grep ツール推奨）
- `@/` エイリアスは各アプリの `src/` を指すため、このパターンで `@/shared/lib/resource` のようなパスもヒットする
- ファイル名 grep（`from.*errors`）ではバレル経由の import を見逃すため使わない

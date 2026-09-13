---
name: check-diff-impact
description: 現在のブランチの変更差分を分析し、影響を受けるURLを特定します。
user-invocable: true
argument-hint: "[ベースブランチ]"
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(git branch:*), Bash(git log:*), Bash(ls:*)
---

現在のブランチの変更差分を分析し、影響を受けるURLを特定します。

## 使い方

```
/check-diff-impact [ベースブランチ]
```

ベースブランチ省略時は [.claude/rules/diff-scope.md](../../rules/diff-scope.md) の「ベースブランチの検出」に従って自動検出する。

## 手順

### 1. ベースブランチの決定と変更ファイルの取得

`.claude/rules/diff-scope.md` に従い、未ステージ・ステージング済み・コミット済みの 3 層を統合した変更ファイル一覧を取得する（除外 pathspec も同規約に従う）。

変更ファイルが存在しない場合は「変更差分がありません」と出力して終了。

**出力**: 変更ファイルパスのリスト（重複排除済み）→ 手順2の入力

### 2. 影響URLの特定

変更ファイルのパスから、影響を受けるURLを特定する。

#### ページファイルの場合（直接的な影響）

このリポジトリは npm workspaces のモノレポで、Next.js アプリは 2 つある（`.claude/rules/diff-scope.md` の「モノレポのパスプレフィックス」参照）:

- `service-front/src/app/`（ユーザー向け・localhost:3000）
- `admin-front/src/app/`（管理画面・localhost:3001）

下表のパスはプレフィックス（`service-front/src/` / `admin-front/src/`）を除いた相対パターンとして照合し、影響 URL は**アプリごとに分けて**報告する。

| ファイルパス | 影響URL |
|------------|---------|
| `app/page.tsx` | `/` |
| `app/about/page.tsx` | `/about` |
| `app/blog/[slug]/page.tsx` | `/blog/*` |
| `app/blog/[...slug]/page.tsx` | `/blog/**` |
| `app/(group)/dashboard/page.tsx` | `/dashboard`（route group は URL に含まない） |
| `app/api/users/route.ts` | `/api/users` |
| `pages/index.tsx` | `/`（Pages Router） |
| `pages/about.tsx` | `/about`（Pages Router） |

**動的ルートの表記**: `[slug]` → `*`、`[...slug]` → `**`

#### コンポーネント・ユーティリティの場合（間接的な影響）

変更されたファイルを import しているファイルを逆引きする。フォルダ構成規約により外部からの import は `index.ts` 経由（例: `@/shared/lib/resource`）なので、**ファイル名ではなく親フォルダ名（バレル名）で検索する**（詳細は `.claude/rules/diff-scope.md` の「import 逆引きの方法」参照）:

- 検索キーワード: 変更ファイルの親フォルダ名（`Foo/Foo.tsx` → `Foo`、`resource/errors.ts` → `resource`）
- Grep ツールでパターン `from ['"].*/(バレル名)['"]` を `service-front/src/` と `admin-front/src/` の**両方**に対して実行（`*.ts` / `*.tsx` 対象）

検索結果がページファイル（`page.tsx`, `route.ts`）であればそのURLを追加。
ページファイルでなければ、さらにそのファイルを import しているファイルを検索する（**最大3段階まで**）。

#### グローバル影響（全ページに影響）

以下のファイルが変更された場合は「該当アプリの全ページに影響」と判定（プレフィックス除去後の相対パターン。`packages/` 配下の共有パッケージ変更は**両アプリの利用箇所**を逆引きする）:
- `app/layout.tsx`（ルートレイアウト）
- `app/template.tsx`
- `src/middleware.ts` / `src/proxy.ts` / `middleware.ts`
- `app/globals.css` / `src/styles/**/*.css`
- `tailwind.config.*`
- `next.config.*`
- `pages/_app.tsx`, `pages/_document.tsx`（Pages Router）

**出力**: 影響URL一覧 → 手順3の入力

### 3. 出力フォーマット

```
変更差分の影響分析
═══════════════════════════════
ベースブランチ: <検出されたブランチ名>

## 影響を受けるURL

- <URL>（<影響元ファイル>）
- ...

### グローバル影響
<あり（対象ファイル名） or なし>

## 変更ファイル → URL 対応

| ファイル | 影響URL | 影響種別 |
|---------|---------|---------|
| `app/about/page.tsx` | `/about` | 直接 |
| `src/components/Header.tsx` | 全ページ | 間接（layout.tsx 経由） |

## サマリー
影響URL: <件数>件
変更ファイル: <件数>件
グローバル影響: <あり or なし>
```

### 4. 確認用URL

アプリごとに分けて出力する:

```
## 確認用URL

### service-front (localhost:3000)
- http://localhost:3000/<URL>

### admin-front (localhost:3001)
- http://localhost:3001/<URL>
```

ポート番号は各ワークスペースの `package.json` の `scripts.dev` から自動検出を試み、見つからなければ service-front は `3000`、admin-front は `3001` を使用。影響がないアプリのセクションは省略する。

## 除外設定

`.claude/rules/diff-scope.md` の「除外 pathspec」に従う（lockfile・`node_modules` 等・バイナリファイルは対象外）。

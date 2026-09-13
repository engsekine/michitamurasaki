# Supabase

ローカル Supabase スタックの設定（`config.toml`）とマイグレーション（`migrations/`）を管理するディレクトリ。

> リポジトリ全体の構成・サービスの起動順序は [ルートの readme](../readme.md#web-サービス全体の環境構築) を参照してください。
> service-front / admin-front はどちらもこのローカル Supabase を共有します。
> **stg / prod（リモート）**へのマイグレーション反映は CI/CD が自動で行うため、リモートに対する手動 `supabase db push` は不要です（[ルート readme の「デプロイ」章](../readme.md#デプロイstg--prod)）。ローカル開発の `make supabase-reset` / `supabase migration up` は従来どおり使います。

## 前提

Supabase CLI と Docker が必要です。

```bash
# Supabase CLI のインストール（macOS）
brew install supabase/tap/supabase

# Docker Desktop が起動していること
```

## 環境変数（supabase/.env）

`config.toml` 内の `env(...)` 参照は、**このディレクトリの `.env`** から読み込まれます。`supabase/.env.example` をコピーして作成してください。

```bash
cp supabase/.env.example supabase/.env
```

| 変数 | 必須 | 説明 |
|------|:---:|------|
| `SMTP_ENABLED` | ✓ | 認証メールの実送信（Resend）を有効にするか。**未定義だと `supabase start` がパースエラーで起動しない**。ローカルは `false` 推奨（メールは Mailpit http://127.0.0.1:54324 が捕捉） |
| `RESEND_API_KEY` | `SMTP_ENABLED=true` 時 | Resend の API キー |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | Google ログイン使用時 | Google OAuth の認証情報 |
| `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN` | SMS 実送信時 | Twilio の Auth Token（未設定でも警告のみで動作する） |

> seed 生成用の `TEST_USER_*` は `.env` ではなく **`supabase/.env.local`** に置きます（「初期データ」セクションのテンプレート方式を参照）。

## 起動・停止

```bash
# ローカル Supabase を起動
supabase start

# 状態を確認（URL とキーが表示される）
supabase status

# 停止
supabase stop

# DB を初期化して停止（マイグレーション再適用したい場合）
supabase stop --no-backup
```

## 主なローカルエンドポイント

| サービス | URL |
|---------|------|
| API | http://127.0.0.1:54321 |
| DB | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Studio（管理画面） | http://127.0.0.1:54323 |
| Inbucket（メール確認） | http://127.0.0.1:54324 |

> 初回 `supabase start` 実行時は Docker イメージのダウンロードに時間がかかります。
> 起動後、`supabase status` で表示される `API URL` と `anon key`[^anon-key] を `service-front/.env.local` の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` に設定してください。

[^anon-key]: 現行の Supabase CLI では `anon key` の表記が `Authentication Keys` セクションの `Publishable key` に変わっています。実際にはこの `Publishable key` を `NEXT_PUBLIC_SUPABASE_ANON_KEY` に設定してください。

---

## マイグレーション管理

スキーマ変更は `migrations/` 配下の SQL ファイルでバージョン管理します。ファイル名は `<timestamp>_<name>.sql`（例: `20260509100821_create_users.sql`）の形式で、CLI がタイムスタンプ順に自動認識します。

### 新規マイグレーションを作成

```bash
# supabase/migrations/<timestamp>_create_users.sql が生成される
supabase migration new create_users
```

生成された SQL ファイルにスキーマ定義を書く：

```sql
create table public.users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    created_at timestamptz not null default now()
);

alter table public.users enable row level security;
```

### ローカルに適用

#### 案 A: 未適用分だけ流す（既存データを保つ）

```bash
supabase migration up
```

`supabase_migrations.schema_migrations` の履歴を見て、未適用のものだけ順に流します。

#### 案 B: DB を初期化して全部流し直す

```bash
supabase db reset
```

ローカル DB を一度 drop してすべてのマイグレーションを最初から流します。`seed.sql` があれば最後に流れます。**既存データは消えます**（開発時は基本これで OK）。

### 適用状況の確認

```bash
supabase migration list
```

出力例:

```
        LOCAL          │     REMOTE     │     TIME (UTC)
  ─────────────────────┼────────────────┼──────────────────────
    20260509100821     │                │ 2026-05-09 10:08:21
```

`LOCAL` 側のみ → ローカルにファイルがあり未適用、`REMOTE` 側のみ → リモートに適用済みでローカルにファイルなし、両方表示 → 同期済み。

### リモート（本番/staging）に反映

```bash
# 初回のみ：プロジェクトをリンク
supabase link --project-ref <your-project-ref>

# 未適用のマイグレーションをリモートに push
supabase db push
```

### 履歴がずれた場合の修正

```bash
# 手動で applied/reverted を記録
supabase migration repair --status applied 20260509100821
```

### 既存 DB から差分を逆生成

Studio で GUI からテーブルを作った後、差分を SQL に落とせます：

```bash
# ローカル DB の現状とマイグレーション履歴の差分をファイル出力
supabase db diff -f add_posts_table
```

---

## 型を TypeScript に生成

スキーマから TS 型を生成し `@repo/supabase` 経由でアプリ全体に共有します：

```bash
supabase gen types typescript --local > ../packages/supabase/src/database.types.ts
```

`packages/supabase/src/types.ts` で `export type { Database } from './database.types';` に書き換えれば、`createClient<Database>(...)` の戻り値が型安全になります。

---

## 初期データ（任意）

開発時に毎回投入したいデータは `seed.sql` に書きます。`supabase db reset` 時に自動で流れます。

### テンプレート + envsubst 方式

このリポジトリではテストユーザーの認証情報を環境変数で管理するため、`seed.sql` は `seed.sql.template` から生成する運用にしています。

```
supabase/
├── .env.example       # サンプル値（commit する）
├── .env.local         # 実値（gitignore）
├── seed.sql.template  # ${TEST_USER_*} を含むテンプレート（commit する）
└── seed.sql           # envsubst で展開した生成物（gitignore）
```

#### 初回セットアップ

```bash
# .env.local を作成して実値を入れる
cp supabase/.env.example supabase/.env.local
$EDITOR supabase/.env.local
```

#### 適用

```bash
# seed.sql を生成して supabase db reset を実行
make supabase-reset

# seed.sql の生成だけしたい場合
make supabase-seed
```

### `seed.sql` を直接書く場合

テンプレート不要なら `seed.sql.template` を消して `seed.sql` を直接編集すれば従来通り動きます（`.gitignore` の `supabase/seed.sql` 行も外す）。

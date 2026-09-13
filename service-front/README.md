# service-front

Next.js 16を使用したフロントエンドアプリケーション（ユーザー向け・ポート 3000）

> リポジトリ全体の構成・サービスの起動順序は [ルートの readme](../readme.md#web-サービス全体の環境構築) を参照してください。
> 起動には **ローカル Supabase が先に立ち上がっていること**が前提です（[supabase/README.md](../supabase/README.md)）。
> stg / prod へのデプロイは [ルート readme の「デプロイ」章](../readme.md#デプロイstg--prod) を参照（develop → stg / main → prod の自動反映）。

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript 5.7
- **スタイル**: Tailwind CSS v4
- **データフェッチング**: TanStack Query (React Query)
- **状態管理**: Zustand
- **フォーム**: React Hook Form + Yup
- **テスト**: Jest, Playwright, Testing Library
- **開発ツール**: Storybook, ESLint, Prettier

---

## クイックスタート

**最も簡単な方法（Makefile使用）:**

```bash
cd service-front

# 初回セットアップ（SSL証明書生成 + npm install）
make setup

# 開発サーバー起動（HTTPS）
make dev-https
```

**手動でセットアップする場合は [セットアップ](#セットアップ) を参照してください。**

---

## セットアップ

### 1. パッケージのインストール

```bash
npm install
```

### 2. ローカル開発環境のSSL化（必須）

#### mkcertのインストール

mkcertは、ローカル環境で信頼できるSSL証明書を生成するツールです。

**macOS（Homebrew）**
```bash
brew install mkcert

# mkcertをシステムにインストール
mkcert -install

# localhost用の証明書を生成
mkcert localhost 127.0.0.1 ::1
```

**Windows（Chocolatey）**
```bash
choco install mkcert
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

**Linux（Ubuntu/Debian）**
```bash
sudo apt install libnss3-tools
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert-v1.4.4-linux-amd64
sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert

mkcert -install
mkcert localhost 127.0.0.1 ::1
```

#### 証明書の配置

生成された証明書ファイルをプロジェクトルート直下に配置：

```bash
# 生成されたファイルをリネーム
mv localhost+2.pem localhost.pem
mv localhost+2-key.pem localhost-key.pem
```

**ファイル構成:**
```
service-front/
├── localhost.pem         # SSL証明書
├── localhost-key.pem     # 秘密鍵
├── package.json
└── ...
```

#### なぜHTTPS化が必要？

- Service Worker（PWA）の動作に必須
- Web Cryptography APIの使用に必須
- 本番環境に近い環境でのテスト
- Cookie（Secure属性）のテスト

---

## 開発サーバーの起動

### HTTP（通常モード）
```bash
npm run dev
# http://localhost:3000
```

### HTTPS（推奨）
```bash
npm run dev:https
# https://localhost:3000
```

---

## スクリプト一覧

### 開発
- `npm run dev` - 開発サーバー起動（HTTP）
- `npm run dev:https` - 開発サーバー起動（HTTPS）

### ビルド・本番
- `npm run build` - プロダクションビルド
- `npm start` - プロダクションサーバー起動

### コード品質
- `npm run lint` - ESLintチェック
- `npm run lint:fix` - ESLint自動修正
- `npm run prettier` - Prettierチェック
- `npm run prettier:fix` - Prettier自動修正
- `npm run format` - Lint + Prettier一括修正
- `npm run type-check` - TypeScript型チェック

### テスト
- `npm run test` - Jestユニットテスト
- `npm run test:watch` - テストウォッチモード
- `npm run test:coverage` - カバレッジ生成
- `npm run test:e2e` - Playwright E2Eテスト
- `npm run test:all` - 全テスト実行

### Storybook
- `npm run storybook` - Storybook起動
- `npm run build-storybook` - Storybookビルド

### 総合チェック
- `npm run validate` - 型チェック + Lint + テスト

---

## Makeコマンド

プロジェクトには便利なMakefileが用意されています。

### セットアップ
- `make setup` - 初回セットアップ（SSL証明書生成 + npm install）
- `make cert` - SSL証明書のみ生成
- `make clean` - すべてクリーンアップ（node_modules + 証明書）
- `make clean-cert` - SSL証明書のみ削除

### 開発
- `make dev` - 開発サーバー起動（HTTP）
- `make dev-https` - 開発サーバー起動（HTTPS、証明書自動生成）

### ビルド・テスト
- `make build` - プロダクションビルド
- `make test` - テスト実行
- `make lint` - Lint実行
- `make format` - フォーマット実行
- `make type-check` - 型チェック
- `make validate` - すべてのチェック実行

### ヘルプ
- `make help` - 利用可能なコマンド一覧表示

**例:**
```bash
# 初回セットアップ
make setup

# 開発サーバー起動（証明書がなければ自動生成）
make dev-https

# すべてクリーンアップして再セットアップ
make clean && make setup
```

---

## Docker開発環境

```bash
# 開発環境起動
docker-compose -f docker-compose.dev.yml up

# バックグラウンド起動
docker-compose -f docker-compose.dev.yml up -d

# ログ確認
docker-compose -f docker-compose.dev.yml logs -f

# 停止
docker-compose -f docker-compose.dev.yml down
```

---

## ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx          # Root Layout
│   ├── page.tsx            # トップページ
│   └── providers.tsx       # グローバルProvider
├── components/
│   └── ui/                 # shadcn/ui コンポーネント
├── hooks/
│   └── use-posts.ts        # カスタムフック（TanStack Query）
├── stores/
│   ├── example-store.ts    # Zustandストア例
│   └── user-store.ts       # ユーザーストア
├── lib/
│   └── react-query.ts      # TanStack Query設定
└── styles/
```

---

## 使用例

詳細な使用方法は [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) を参照してください。

### TanStack Query（データフェッチング）

```tsx
import { usePosts } from "@/hooks/use-posts";

export function PostList() {
  const { data, isLoading, error } = usePosts();

  if (isLoading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {error.message}</div>;

  return (
    <ul>
      {data?.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### Zustand（状態管理）

```tsx
import { useUserStore } from "@/stores/user-store";

export function UserProfile() {
  const { user, setUser, clearUser } = useUserStore();

  return (
    <div>
      {user ? (
        <>
          <p>ようこそ、{user.name}さん</p>
          <button onClick={clearUser}>ログアウト</button>
        </>
      ) : (
        <button onClick={() => setUser({ id: "1", name: "太郎", email: "taro@example.com" })}>
          ログイン
        </button>
      )}
    </div>
  );
}
```

---

## トラブルシューティング

### SSL証明書エラーが出る場合

```bash
# mkcertを再インストール
mkcert -uninstall
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

### ポート3000が使用中の場合

```bash
# プロセスを確認
lsof -i :3000

# プロセスを終了
kill -9 <PID>

# または別のポートで起動
npm run dev -- -p 3001
```

### node_modulesの問題

```bash
# クリーンインストール
rm -rf node_modules package-lock.json
npm install
```

---

## 環境変数

`.env.example` をコピーして `.env` を作成し、値を設定します（Supabase の URL / anon key は `supabase status` で表示される値を使用）。

```bash
# 公開環境変数（クライアント側で使用可能）
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# サーバー側のみの環境変数
NODEMAILER_USER=your_email@example.com
NODEMAILER_PASS=your_password

# Stripe（ログ枠購入 / 026。決済を使う場合のみ・詳細は下記「Stripe の設定」）
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
```

---

## Stripe の設定（ログ枠購入 / 026）

ログパック購入（`/settings/log-credits`）を動かす場合のみ必要です。決済機能を触らないなら設定不要です。

### 1. API キーと webhook 転送

```bash
brew install stripe/stripe-cli/stripe   # 未インストールの場合
stripe login

# dev サーバーの起動モードに合わせて転送先のスキームを揃えること
stripe listen --forward-to https://localhost:3000/api/stripe/webhook --skip-verify  # make dev-https（推奨モード）の場合
stripe listen --forward-to http://localhost:3000/api/stripe/webhook                 # make dev（HTTP）の場合
```

必要な環境変数（`.env`）:

| 変数 | 値 |
|------|-----|
| `STRIPE_SECRET_KEY` | [Stripe ダッシュボード](https://dashboard.stripe.com/test/apikeys)（**テストモード**）の `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` 起動時に出力される `whsec_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase status` の `SERVICE_ROLE_KEY`。**webhook の枠付与処理に必須**（無いと署名検証後に 500） |

- 枠の付与は webhook（`checkout.session.completed`）経由のため、**`stripe listen` を起動していないと決済しても残枠に反映されません**
- ハマりどころ:
  - `--forward-to` を付け忘れると転送されない（イベント表示のみ）
  - dev サーバーが HTTPS（`make dev-https`）なのに `http://` へ転送すると `EOF` エラーになる。`https://` + `--skip-verify` にする
  - `.env` を変更したら dev サーバーの再起動が必要
  - 取りこぼしたイベントは `stripe events list` → `stripe events resend <evt_...>` で再送できる（付与は冪等）

### 2. テスト用カード番号

サンドボックス（テストモード）では実在のカード番号は使えず、Stripe が用意している専用のテスト番号を入力します。

**基本の成功用カード（一番使う「決済成功」パターン）:**

| 項目 | 値 |
|------|-----|
| 番号 | `4242 4242 4242 4242`（Visa） |
| 有効期限 | 未来の任意の日付（例: `12/34`） |
| CVC | 任意の 3 桁（例: `123`） |
| 郵便番号 | 任意（例: `12345`） |

**主なブランド別（成功する番号）:**

| ブランド | 番号 |
|---------|------|
| Visa | `4242 4242 4242 4242` |
| Mastercard | `5555 5555 5555 4444` |
| American Express | `3782 822463 10005` |
| JCB | `3566 0020 2036 0505` |

**失敗系（エラーハンドリングの確認用）:**

| ケース | 番号 |
|--------|------|
| 決済拒否（generic decline） | `4000 0000 0000 0002` |
| 残高不足 | `4000 0000 0000 9995` |

その他のテストカードは [Stripe 公式ドキュメント](https://docs.stripe.com/testing) を参照。

### 3. 動作確認の流れ

1. `stripe listen` を起動した状態でアプリにログイン
2. `/settings/log-credits` →「購入する」→ テストカードで支払い
3. success で戻り、残枠が +10 されることを確認（反映まで最大 1 分）
4. 冪等性の確認: `stripe events resend <event_id>` で再送しても二重付与されないこと

---

## .gitignoreへの追加

証明書ファイルは**Gitにコミットしない**でください：

```gitignore
# SSL証明書（各開発者がローカルで生成）
localhost*.pem
*.key
*.crt
```

---

## ライセンス

Private

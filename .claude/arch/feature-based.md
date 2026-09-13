# Feature-based + shared/ アーキテクチャ

> **適用範囲: service-front / admin-front 共通**
> 両プロジェクトとも本ドキュメントの Feature-based + shared/ 構造に従う。コードを生成・移動するときは必ず参照すること。

## 概要

**Feature-basedアーキテクチャ**は、機能単位でコードを分割する設計手法です。各機能は独立したモジュールとして管理され、横断的に使う汎用リソースは`shared/`に配置します。

### 設計原則
- **機能の独立性**: 各featureは他のfeatureに依存しない
- **明確な依存方向**: `app/` → `features/` → `shared/`
- **再利用性**: 複数のfeatureで使うものは`shared/`に昇格
- **保守性**: 機能ごとにディレクトリが分かれているため、変更の影響範囲が明確

---

## ディレクトリ構成（Next.js App Router想定）

```
src/
├── app/                        # Next.js ルーティング層（薄く保つ）
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── dashboard/page.tsx
│   └── layout.tsx
│
├── features/                   # 機能単位のモジュール
│   ├── auth/
│   │   ├── components/         # この機能専用のUI
│   │   │   ├── LoginForm.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── hooks/              # この機能専用のhooks
│   │   │   └── useAuth.ts
│   │   ├── api/                # API呼び出し（Server Actions or fetch）
│   │   │   └── authApi.ts
│   │   ├── stores/             # この機能のstate（Zustand等）
│   │   │   └── authStore.ts
│   │   ├── types.ts            # この機能の型定義
│   │   └── index.ts            # パブリックAPI
│   │
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── MetricsCard.tsx
│   │   │   └── ActivityFeed.tsx
│   │   ├── hooks/
│   │   │   └── useDashboardData.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   └── settings/
│       ├── components/
│       ├── hooks/
│       ├── types.ts
│       └── index.ts
│
└── shared/                     # 横断的に使う汎用リソース
    ├── components/             # 汎用UIコンポーネント
    │   ├── ui/                 # shadcn/ui等のプリミティブ
    │   │   ├── Button.tsx
    │   │   ├── Input.tsx
    │   │   └── Modal.tsx
    │   └── layout/             # レイアウト系
    │       ├── Header.tsx
    │       └── Sidebar.tsx
    ├── hooks/                  # 汎用hooks
    │   ├── useDebounce.ts
    │   └── useLocalStorage.ts
    ├── utils/                  # ユーティリティ関数
    │   ├── date.ts
    │   └── format.ts
    ├── types/                  # 共通型（API共通型等）
    │   └── api.ts
    ├── stores/                 # グローバルstate
    │   ├── themeStore.ts
    │   └── toastStore.ts
    └── lib/                    # 外部ライブラリの設定・初期化
        ├── queryClient.ts
        └── axios.ts
```

---

## 依存の方向ルール

```
app/  →  features/  →  shared/
          ↑ここは                ↑ここだけ
          feature間の            横断参照OK
          参照を避ける
```

### ✅ OK（許可される依存）
```tsx
// features/dashboard/ が shared/ を使う
import { Button } from '@/shared/components/ui/Button'

// app/ が features/ を使う
import { DashboardView } from '@/features/dashboard'

// features/ が shared/ を使う
import { useDebounce } from '@/shared/hooks/useDebounce'
```

### ❌ NG（避けるべき依存）
```tsx
// features/auth/ が features/dashboard/ を直接 import
import { MetricsCard } from '@/features/dashboard/components/MetricsCard'  // NG

// shared/ が features/ を import
import { useAuth } from '@/features/auth'  // NG
```

### 💡 解決策
**feature間で共有したいものが出てきたら → `shared/` に昇格させる**

```tsx
// 共通化する場合
// shared/components/MetricsCard.tsx に移動
export const MetricsCard = () => { /* ... */ }

// 両方のfeatureから使える
import { MetricsCard } from '@/shared/components/MetricsCard'
```

---

## featuresの中身の粒度

### コンポーネントの置き場の判断基準

| 判断 | 置き場所 | 例 |
|---|---|---|
| この機能でしか使わない | `features/{name}/components/` | `LoginForm`, `DashboardChart` |
| 2つ以上のfeatureで使う | `shared/components/` | `UserAvatar`, `StatusBadge` |
| デザイントークン・プリミティブUI | `shared/components/ui/` | `Button`, `Input`, `Modal` |
| レイアウト系 | `shared/components/layout/` | `Header`, `Sidebar`, `Footer` |

### hooksの置き場の判断基準

| 内容 | 置き場所 | 例 |
|---|---|---|
| API呼び出し + その機能固有のstate | `features/{name}/hooks/` | `useAuth`, `useDashboardData` |
| 汎用的なカスタムhooks | `shared/hooks/` | `useDebounce`, `useMediaQuery`, `useLocalStorage` |

### storesの置き場の判断基準

| 内容 | 置き場所 | 例 |
|---|---|---|
| feature固有のstate | `features/{name}/stores/` | `authStore`, `cartStore` |
| グローバルなstate | `shared/stores/` | `themeStore`, `toastStore`, `modalStore` |

---

## index.ts でパブリックAPIを明示する（推奨）

各featureにバレルファイルを置き、外部に公開するものを明示することで、カプセル化を強化します。

### メリット
- import pathが安定する
- 内部実装の変更が外部に影響しにくい
- 公開APIが明確になる

```ts
// features/auth/index.ts
export { LoginForm } from './components/LoginForm'
export { AuthGuard } from './components/AuthGuard'
export { useAuth } from './hooks/useAuth'
export type { User, AuthState } from './types'

// 内部実装は export しない
// AuthButton, validatePassword などは内部でのみ使用
```

```tsx
// app/login/page.tsx
import { LoginForm } from '@/features/auth'  // パスが安定する

export default function LoginPage() {
  return <LoginForm />
}
```

---

## Next.js App Router との対応

### ページコンポーネントの設計

```tsx
// app/dashboard/page.tsx
// ← 薄いエントリーポイント（ルーティングのみ）
import { DashboardView } from '@/features/dashboard'

export default function DashboardPage() {
  return <DashboardView />
}
```

```tsx
// features/dashboard/components/DashboardView.tsx
// ← 実態はここ（ビジネスロジック）
import { MetricsCard } from './MetricsCard'
import { ActivityFeed } from './ActivityFeed'
import { Card } from '@/shared/components/ui/Card'

export const DashboardView = () => {
  return (
    <div>
      <MetricsCard />
      <ActivityFeed />
    </div>
  )
}
```

### Server Components / Client Components の分離

Server Components / Client Components の境界も feature 単位で管理しやすくなります。
`features/{name}/components/` の中で `'use client'` を持つファイルを明示的に分けると見通しがよくなります。

```
features/dashboard/components/
├── DashboardView.tsx          # Server Component（デフォルト）
├── MetricsCard.tsx            # Server Component
└── client/                    # または _client/ など命名で区別
    └── InteractiveChart.tsx   # 'use client'
```

```tsx
// features/dashboard/components/DashboardView.tsx (Server Component)
import { MetricsCard } from './MetricsCard'
import { InteractiveChart } from './client/InteractiveChart'

export const DashboardView = async () => {
  const data = await fetchDashboardData()  // サーバーで取得

  return (
    <div>
      <MetricsCard data={data} />
      <InteractiveChart data={data} />  {/* Client Componentに渡す */}
    </div>
  )
}
```

```tsx
// features/dashboard/components/client/InteractiveChart.tsx
'use client'

import { useState } from 'react'

export const InteractiveChart = ({ data }) => {
  const [filter, setFilter] = useState('all')

  return (
    <div>
      {/* インタラクティブなチャート */}
    </div>
  )
}
```

---

## よくある判断パターン

### Q1. 認証チェックのコンポーネントはどこに置く？

**A:** `features/auth/components/AuthGuard.tsx`

認証機能の責務なので auth feature に置きます。app層から使います。

```tsx
// features/auth/components/AuthGuard.tsx
export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth()

  if (isLoading) return <Loading />
  if (!user) redirect('/login')

  return <>{children}</>
}

// features/auth/index.ts
export { AuthGuard } from './components/AuthGuard'

// app/dashboard/layout.tsx
import { AuthGuard } from '@/features/auth'

export default function DashboardLayout({ children }) {
  return <AuthGuard>{children}</AuthGuard>
}
```

### Q2. APIのエラーハンドリングはどこに書く？

**A:** `shared/lib/axios.ts` にインターセプターとして共通化

各featureの `api/` ではビジネスロジックだけ書きます。

```ts
// shared/lib/axios.ts
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

// 共通エラーハンドリング
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 認証エラー処理
    }
    return Promise.reject(error)
  }
)
```

```ts
// features/dashboard/api/dashboardApi.ts
import { apiClient } from '@/shared/lib/axios'

export const fetchDashboardData = async () => {
  const { data } = await apiClient.get('/dashboard')  // エラーハンドリングは共通化済み
  return data
}
```

### Q3. TanStack Query の queryKey はどこで管理する？

**A:** 各 `features/{name}/api/` 内で定数として定義するのがシンプル

大規模なら `features/{name}/api/queryKeys.ts` に分離します。

```ts
// features/dashboard/api/dashboardApi.ts
export const dashboardKeys = {
  all: ['dashboard'] as const,
  data: () => [...dashboardKeys.all, 'data'] as const,
  metrics: (period: string) => [...dashboardKeys.all, 'metrics', period] as const,
}

export const useDashboardData = () => {
  return useQuery({
    queryKey: dashboardKeys.data(),
    queryFn: fetchDashboardData,
  })
}
```

または分離する場合:

```ts
// features/dashboard/api/queryKeys.ts
export const dashboardKeys = {
  all: ['dashboard'] as const,
  data: () => [...dashboardKeys.all, 'data'] as const,
  metrics: (period: string) => [...dashboardKeys.all, 'metrics', period] as const,
}

// features/dashboard/api/dashboardApi.ts
import { dashboardKeys } from './queryKeys'

export const useDashboardData = () => {
  return useQuery({
    queryKey: dashboardKeys.data(),
    queryFn: fetchDashboardData,
  })
}
```

### Q4. Zustand のストアはどこに置く？

**A:**
- feature固有のstateは `features/{name}/stores/`
- グローバルなもの（テーマ、トースト等）は `shared/stores/`

```ts
// features/auth/stores/authStore.ts
import { create } from 'zustand'

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}))

// shared/stores/themeStore.ts
import { create } from 'zustand'

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  toggleTheme: () => set((state) => ({
    theme: state.theme === 'light' ? 'dark' : 'light'
  })),
}))
```

### Q5. バリデーションロジックはどこに置く？

**A:** feature固有のバリデーションは `features/{name}/utils/` または `features/{name}/validators/`

汎用的なバリデーション関数は `shared/utils/validation.ts`

```ts
// features/auth/validators/loginSchema.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上です'),
})

// shared/utils/validation.ts
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
export const isEmpty = (value: string) => value.trim().length === 0
```

### Q6. 定数（constants）はどこに置く？

**A:**
- feature固有の定数は `features/{name}/constants.ts`
- 共通定数は `shared/constants/`

```ts
// features/auth/constants.ts
export const AUTH_STORAGE_KEY = 'auth_token'
export const TOKEN_EXPIRY_DAYS = 7

// shared/constants/routes.ts
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
} as const

// shared/constants/config.ts
export const APP_NAME = 'MyApp'
export const API_TIMEOUT = 10000
```

---

## マイグレーション戦略

既存プロジェクトをFeature-basedに移行する場合の段階的アプローチ:

### フェーズ1: shared/ の整備
1. 汎用コンポーネントを `shared/components/` に移動
2. 共通hooksを `shared/hooks/` に移動
3. ユーティリティ関数を `shared/utils/` に移動

### フェーズ2: 1つのfeatureを試験的に切り出す
1. 最も独立性の高い機能を選ぶ（例: auth）
2. `features/auth/` を作成し、関連するファイルを移動
3. `features/auth/index.ts` でパブリックAPIを定義

### フェーズ3: 他のfeatureを順次移行
1. ドメイン単位で feature を切り出す
2. feature間の依存があれば `shared/` に昇格
3. 既存コードとの互換性を保ちながら進める

---

## チェックリスト

### 新しいfeatureを追加するとき
- [ ] `features/{name}/` ディレクトリを作成
- [ ] `features/{name}/index.ts` でパブリックAPIを定義
- [ ] 他のfeatureに依存していないか確認
- [ ] 2つ以上のfeatureで使う可能性があるものは `shared/` に配置

### コンポーネントを作成するとき
- [ ] この機能でしか使わない → `features/{name}/components/`
- [ ] 複数のfeatureで使う → `shared/components/`
- [ ] プリミティブなUI → `shared/components/ui/`

### hooksを作成するとき
- [ ] 特定の機能に紐づく → `features/{name}/hooks/`
- [ ] 汎用的 → `shared/hooks/`

### 型定義を作成するとき
- [ ] feature固有の型 → `features/{name}/types.ts`
- [ ] API共通型、グローバル型 → `shared/types/`

---

## 参考リンク

- [Feature-Sliced Design](https://feature-sliced.design/)
- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)

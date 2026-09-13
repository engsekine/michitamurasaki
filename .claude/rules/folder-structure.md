# フォルダ構成規約（service-front / admin-front 共通）

service-front と admin-front は基本的に同じ Feature-based + shared/ 構造に揃える。
コンポーネント・ユーティリティはいずれも **専用フォルダに配置**し、フォルダ内に本体・テスト・`index.ts`（再 export）を並べる。

## コンポーネント作成時のフォルダ構成

新しい React コンポーネントを作成するときは **必ず専用フォルダに配置**し、以下の構造に揃える。

```
<対象パス>/<ComponentName>/
├── <ComponentName>.tsx          ← コンポーネント本体
├── <ComponentName>.test.tsx     ← Vitest 単体テスト
├── <ComponentName>.stories.tsx  ← Storybook story（Storybook 採用プロジェクトのみ・任意）
└── index.ts                     ← 再 export 専用
                                   例: export { ComponentName } from './ComponentName';
```

- 基本構成は **本体 + テスト + index.ts** の3点。`*.stories.tsx` は Storybook を採用しているプロジェクト（service-front）でのみ追加する任意ファイルで、未採用のプロジェクト（admin-front）では不要。

### 配置のルール

| 対象 | 配置例 |
|---|---|
| 汎用コンポーネント | `src/shared/components/<group>/<ComponentName>/...` |
| 機能固有コンポーネント | `src/features/<feature>/components/<ComponentName>/...` |
| Client コンポーネント | `src/features/<feature>/components/client/<ComponentName>/...` |
| Server コンポーネント | `src/features/<feature>/components/server/<ComponentName>/...` |

### import パスの方針

- **外部からは index.ts 経由で import**: `import { Foo } from '@/shared/components/Foo'`（中の `Foo/Foo.tsx` を直接指さない）
- **コンポーネント内部の sibling 参照は親ディレクトリ経由**: `import { Bar } from '../Bar'`（`./Bar` ではなく `../Bar` で隣のフォルダの index.ts を解決）
- **types / hooks / stores 等の上位参照**: フォルダ階層分の `..` を正確に。例えば `Foo/Foo.tsx` から `../../../types` で `features/<feature>/types/` に届く

### 既存コンポーネントの配置例

| パス | 構造 |
|---|---|
| `service-front/src/shared/components/layout/Header/` | Header.tsx + Header.test.tsx + Header.stories.tsx + index.ts |
| `service-front/src/shared/components/form/FormField/` | 同上 |
| `service-front/src/features/dives/components/client/DiveSearchBar/` | 同上 |
| `admin-front/src/shared/components/form/FormField/` | FormField.tsx + index.ts（stories なし） |
| `admin-front/src/shared/components/table/DataTable/` | DataTable.tsx + index.ts（stories なし） |
| `admin-front/src/shared/components/layout/AdminShell/` | AdminShell.tsx + AdminSidebar.tsx + index.ts |

新規作成・移動の際はこれらを参照モデルとする。

## ユーティリティ（lib）作成時のフォルダ構成

`shared/lib` 配下のユーティリティ（純粋関数・ヘルパー等）も **専用フォルダに配置**し、以下の構造に揃える。単一ファイルでもフォルダ化することで、テストの追加・将来の分割（責務ごとのファイル分け）に耐え、兄弟モジュール間で構造が揃う。

```
<対象パス>/<utilName>/
├── <utilName>.ts          ← 実装本体
├── <utilName>.test.ts     ← Vitest 単体テスト
└── index.ts               ← 再 export 専用（例: export * from './<utilName>';）
```

### 配置のルール

| 対象 | 配置例 |
|---|---|
| 汎用ユーティリティ | `src/shared/lib/<utilName>/...` |
| ルート直下ユーティリティ | `src/lib/<utilName>/...` |
| 機能固有ユーティリティ | `src/features/<feature>/lib/<utilName>/...` |

- **複数ファイルに分かれるモジュール**（例: `supabase/` の `browser.ts` / `server.ts` / `middleware.ts`）は、フォルダ内に役割別ファイルを並べる。バレル経由で Server / Browser の依存が混ざりビルドが壊れる場合は、`index.ts` では型のみ公開し実装は個別パスから import する。
- **テストが複数ある場合**（例: `react-query.test.ts` / `react-query.server.test.ts`）も同フォルダ内に並べる。

### import パスの方針

- **外部からは index.ts 経由で import**: `import { todayInJst } from '@/shared/lib/date'`（中の `date/date.ts` を直接指さない）
- **フォルダ内のテスト・sibling 参照は相対パス**: `import { todayInJst } from './date'`

### 既存ユーティリティの配置例

| パス | 構造 |
|---|---|
| `service-front/src/shared/lib/date/` | date.ts + date.test.ts + index.ts |
| `service-front/src/shared/lib/number/` | 同上 |
| `service-front/src/shared/lib/tide/` | 同上 |
| `service-front/src/shared/lib/react-query/` | react-query.ts + react-query.test.ts + react-query.server.test.ts + index.ts |
| `admin-front/src/shared/lib/resource/` | errors.ts + queries.ts + mutations.ts + types.ts + params.ts（+ テスト） |
| `admin-front/src/shared/lib/audit/` | recordAudit.ts |
| `admin-front/src/lib/cn/` | cn.ts + cn.test.ts + index.ts |

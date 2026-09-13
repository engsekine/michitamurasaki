# React コーディング規約

## コンポーネント設計

- 1ファイル1コンポーネントを基本とする
- コンポーネント名はPascalCase（例: `UserProfile`, `ButtonPrimary`）
- ファイル名はコンポーネント名と一致させる（例: `UserProfile.tsx`）
- Props の型定義は `interface` を使用し、コンポーネントの直上に記載する

```tsx
// Good
interface UserProfileProps {
  userId: string;
  name: string;
  avatarUrl?: string;
}

export const UserProfile = ({ userId, name, avatarUrl }: UserProfileProps) => {
  // ...
};
```

## Hooks

- カスタムフックのファイル名・関数名は `use` プレフィックスをつける（例: `useAuth.ts`）
- フックはコンポーネントのトップレベルでのみ呼び出す
- 条件分岐や繰り返しの中でフックを呼ばない

## State管理

- `useState` はシンプルな状態に使用する
- 複数の関連する状態は `useReducer` にまとめることを検討する
- グローバル状態管理ライブラリ（Zustand・Jotai等）はプロジェクトの規約に従う

## イベントハンドラ

- イベントハンドラ名は `handle` プレフィックスをつける（例: `handleClick`, `handleSubmit`）
- Props として渡すイベントハンドラは `on` プレフィックスをつける（例: `onClick`, `onSubmit`）

## レンダリング最適化

- リスト要素には必ず一意の `key` を設定する（インデックスの使用は避ける）
- 重い処理は `useMemo` / `useCallback` でメモ化する
- 不要な再レンダリングを避けるため、`React.memo` の使用を検討する

## UI ライブラリ（shadcn / @repo/ui）のラップ

- **shadcn / `@repo/ui` のコンポーネントを直接編集しない**（複数アプリで共有するため、片方都合の変更で他方が壊れる）
- アプリ側から `@repo/ui/components/*` を **直接 import しない**。必ず `src/shared/components/ui/<Name>/` のラッパー経由で import する
- ラッパーはフォルダ構成規約（`rules/folder-structure.md`）に従い `<Name>/<Name>.tsx` + `index.ts` で配置する
  - スタイルを変えないものは **再 export のみ**（将来の上書きの単一窓口として先に用意しておく）
  - スタイル・挙動を変えるものは、`cn`（tailwind-merge）で className を上書きする。`@repo/ui` 側の値は tailwind-merge により後勝ちで置き換わる

```tsx
// Bad: shadcn を直接 import／直接編集
import { Button } from '@repo/ui/components/button';

// Good: service-front 側のラッパー経由
import { Button } from '@/shared/components/ui/Button';
```

```tsx
// ラッパー例（見た目を上書きする場合）: src/shared/components/ui/Button/Button.tsx
import { Button as UiButton, buttonVariants as uiButtonVariants } from '@repo/ui/components/button';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

type ButtonVariantOptions = Parameters<typeof uiButtonVariants>[0];

// Link に渡す用途。@repo/ui の font-medium は tailwind-merge で font-bold に置き換わる
export const buttonVariants = (options?: ButtonVariantOptions): string => cn(uiButtonVariants(options), 'font-bold');

export const Button = ({ className, ...props }: ComponentProps<typeof UiButton>) => (
    <UiButton className={cn('font-bold', className)} {...props} />
);
```

- ブランドカラー等のトークンレベルの変更は、各アプリの `globals.css` で CSS カスタムプロパティ（`--primary` 等）を上書きする（`@repo/ui` の token を直接書き換えない）

## React Hook Form

- `register`、`control`、`formState` などの react-hook-form オブジェクトをそのまま Props として子コンポーネントに渡さない
- 必要な値・関数のみを明示的に Props として渡す

```tsx
// Bad
interface InputProps {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
}

// Good
interface InputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}
```

- フォームロジックは親コンポーネントまたはカスタムフックに閉じ込め、UIコンポーネントは react-hook-form に依存させない
- 再利用可能な入力コンポーネントには `Controller` で包んで渡す

```tsx
// Good: Controller で包んで渡す
<Controller
  name="email"
  control={control}
  render={({ field, fieldState }) => (
    <TextInput
      value={field.value}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  )}
/>
```

## その他

- `useEffect` の依存配列を正確に記載する（eslint-plugin-react-hooks に従う）
- コンポーネントは純粋関数として書く（副作用は `useEffect` に閉じ込める）
- デフォルトエクスポートより名前付きエクスポートを優先する

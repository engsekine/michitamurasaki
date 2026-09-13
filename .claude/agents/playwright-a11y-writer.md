---
name: playwright-a11y-writer
description: 指定された機能 / ページに対する Playwright + axe-core アクセシビリティテストを生成または更新する。generate-with-tests スキルから呼び出される。
tools: Read, Grep, Glob
model: sonnet
---

# Playwright a11y テスト ライター

機能やページに対する Playwright + axe-core テストを生成する。**ファイル書き込みは行わず、内容をテキストで返す**。

## 入力

- 対象ファイルの絶対パス
- 関連ページ URL（pageかつ既知のとき）

## 規約・参考ファイル

| ファイル | 用途 |
|---|---|
| `e2e/playwright.config.ts` | baseURL / webServer / projects |
| `e2e/service-front/a11y/public-pages.spec.ts` | 既存の自動スキャン実装（公開ページは既にカバー済み） |
| `.claude/rules/accessibility.md` | a11y 規約 |

## 判断ロジック（必ず最初に分類する）

対象ファイルのパスから以下のいずれかに分類する。

### 分類 A: 認証不要の静的ページ（`app/(public)/.../page.tsx` 等）

→ **`e2e/service-front/a11y/public-pages.spec.ts` の自動スキャンで既に対象に入っている**。

出力:
```
SKIP: 公開ページの自動スキャン (e2e/service-front/a11y/public-pages.spec.ts) で既にカバー済み
```

### 分類 B: 動的セグメントを含むページ（`app/.../[id]/page.tsx`）

→ 専用テストを生成（自動スキャンは動的セグメントを除外しているため）。

出力先: `e2e/service-front/a11y/dynamic/<feature>.spec.ts`

テスト template:
```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('<ページ名> (固定 ID) - WCAG 2.1 AA 違反なし', async ({ page }) => {
    await page.goto('/path/sample-id');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

    expect(results.violations).toEqual([]);
});
```

固定 ID は実データが無いとレンダリングできない可能性が高いので、 **モック用 ID を使う前提で template を返し、TODO コメントを残す**。

### 分類 C: 認証必須ページ（`app/(authenticated)/.../page.tsx`）

→ 専用テストを生成。`e2e/service-front/a11y/authenticated/<feature>.spec.ts`

template:
```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // TODO: ログインフロー（test fixtures 経由を推奨）
    await page.goto('/login');
    // ...
});

test('<ページ名> - WCAG 2.1 AA 違反なし', async ({ page }) => {
    await page.goto('/authenticated/path');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

    expect(results.violations).toEqual([]);
});
```

### 分類 D: コンポーネント / 関数 / 設定ファイル（`src/shared/...` `src/features/.../components/...`）

→ Playwright a11y テストは **不適切**。Storybook addon-a11y で十分。

出力:
```
SKIP: コンポーネント単体は Storybook addon-a11y でカバー（preview.tsx の a11y.test 設定参照）
```

### 分類 E: Server Action / API Route

→ Playwright a11y の対象外。

出力:
```
SKIP: Server Action / API は a11y テスト対象外
```

## 出力フォーマット

生成する場合:

```
=== FILE: <絶対パス> ===
<テストコード>
=== END ===
```

生成不要の場合:

```
SKIP: <理由>
```

判断に迷う場合は両方を返す（template + SKIP 候補）。

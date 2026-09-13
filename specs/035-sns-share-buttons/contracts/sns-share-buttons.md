# UI Contract: SnsShareButtons

**Date**: 2026-07-16 | **Feature**: [spec.md](../spec.md)

`service-front/src/shared/components/social/SnsShareButtons/` に配置する汎用コンポーネントの契約。
状態を持たないため Server Component（`'use client'` 不要）。Instagram 共有は 2026-07-16 改定で削除（spec Clarifications 参照）。

## Props

```ts
interface SnsShareButtonsProps {
    /** 共有する canonical URL（SITE_URL ベースの絶対 URL）。呼び出し元が組み立てる */
    url: string;
    /** 共有テキスト（定型文）。呼び出し元が組み立てる */
    text: string;
}
```

- 共有 URL・テキストの生成ロジックはコンポーネントに持たせない（呼び出し元の Server Component の責務）
- 追加の見た目調整が必要になった場合のみ `className?: string` を拡張する（初期実装では持たない）

## レンダリング契約

アンカー 2 つを横並びで描画する。順序は **X → Facebook**（固定）。

| ボタン | 要素 | アクセシブルな名前 | 動作 |
|--------|------|------------------|------|
| X | `<a target="_blank" rel="noopener noreferrer">` | `X で共有` | `https://x.com/intent/post?text=<text>&url=<url>` へ遷移（新しいタブ） |
| Facebook | `<a target="_blank" rel="noopener noreferrer">` | `Facebook で共有` | `https://www.facebook.com/sharer/sharer.php?u=<url>` へ遷移（新しいタブ） |

- クエリ文字列は `URLSearchParams` で構築する（`#` `&`・絵文字を含むテキストの欠落防止。SC-002）
- 各ボタンはブランド SVG アイコン（`SnsBrandIcons.tsx` の内部コンポーネント）を表示し、アイコン自体は `aria-hidden="true"`。アクセシブルな名前は視覚的に隠したテキスト（`sr-only`）で担保する
- アイコンの配色: X は `currentColor`（テーマ追従）、Facebook はブランドブルー `#0866FF` 固定
- タッチターゲットは 44×44px 以上（accessibility.md）

## 埋め込み契約（呼び出し元）

```tsx
// DiveDetail.tsx（Server Component）— 公開ログのみ
{dive.isPublic && (
    <SnsShareButtons
        url={`${SITE_URL}/dives/${dive.id}`}
        text={`${diveLocationLabel(dive)}のダイビングログ（${formatJstDate(dive.diveDate)}）| ${SITE_NAME}`}
    />
)}

// PublicProfile.tsx（Server Component）— 常時
<SnsShareButtons
    url={`${SITE_URL}${profilePath({ userId: profile.userId, handle: profile.handle })}`}
    text={`${profile.nickname}のダイビングプロフィール | ${SITE_NAME}`}
/>
```

- `SITE_URL` / `SITE_NAME` は `@/shared/constants/site`、`profilePath` は `@/shared/lib/profile-path` を使用
- import は index.ts 経由: `import { SnsShareButtons } from '@/shared/components/social/SnsShareButtons';`

## テスト契約

| テスト | 検証内容 |
|--------|---------|
| Vitest（`SnsShareButtons.test.tsx`） | 2 ボタンのアクセシブルな名前、X / Facebook の href（エンコード込み）、`target="_blank" rel="noopener noreferrer"`、Instagram ボタンが存在しないこと |
| Vitest（`DiveDetail.test.tsx` 同期更新） | `isPublic: true` で共有ボタン表示・`false` で非表示（FR-001 / SC-003） |
| Vitest（`PublicProfile.test.tsx`） | 自分・他人とも共有ボタン表示、handle ベースのプロフィール URL |
| Storybook（`SnsShareButtons.stories.tsx`） | 既定表示 |
| Playwright a11y | ログ詳細・プロフィール双方で axe 違反 0 件（SC-004） |
| Playwright e2e（`tests/sns-share.spec.ts`） | 公開ログ・プロフィールでボタン表示、X / Facebook の href 検証、非公開で非表示 |

# Contract: grant_daily_bonus RPC + DailyBonusModal

**Date**: 2026-07-17 | **Feature**: [spec.md](../spec.md)

## RPC 契約: `grant_daily_bonus()`

```text
grant_daily_bonus() returns boolean
    true  … この呼び出しで当日（JST）分のログ枠 +1 を付与した
    false … 当日分は付与済みだった（no-op）
    error … 未認証（28000）ほか。呼び出し元はエラー時に画面表示を妨げない（FR-005）
```

- 並行呼び出しでも `true` を受け取るのは 1 リクエストのみ（`credit_ledger` の部分ユニーク制約 + `unique_violation` ハンドリング）
- `authenticated` ロールのみ実行可

### 呼び出し元契約（`(authenticated)/layout.tsx`）

```tsx
const { data: granted, error: bonusError } = await supabase.rpc('grant_daily_bonus');
if (bonusError) console.error('[AuthenticatedLayout] デイリーボーナスの付与に失敗しました:', bonusError);

// granted === true のときだけ残枠を取得（通常アクセスにコストを足さない）
const remainingCredits = granted === true ? await getCreditBalance().catch(() => null) : null;

return (
    <>
        {granted === true && <DailyBonusModal remainingCredits={remainingCredits} />}
        {children}
    </>
);
```

## UI 契約: `DailyBonusModal`

配置: `service-front/src/features/credits/components/client/DailyBonusModal/`（Client Component）

```ts
interface DailyBonusModalProps {
    /** 付与後のログ枠残数。取得失敗時は null（枠数表示を省略し獲得の事実のみ表示） */
    remainingCredits: number | null;
}
```

| 項目 | 契約 |
|------|------|
| 基盤 | `@/shared/components/ui/Dialog` ラッパー（shadcn 直 import 禁止 / rules/react.md） |
| 初期状態 | マウント時に開いている（`open=true` の制御 state） |
| タイトル | 「デイリーボーナス獲得！」（Dialog のタイトルとして支援技術に通知される） |
| 本文 | 「ログ枠が 1 つ増えました」+ `remainingCredits` が数値なら「現在の残り枠: {n}」 |
| 導線 | 「ログを書く」→ `/dives/new` へ遷移（US2）/「閉じる」ボタン。モーダルは layout 配下にありクライアント遷移では unmount されないため、リンクのクリック時に明示的に閉じる（`onClick={() => setOpen(false)}`） |
| 閉じる操作 | 閉じるボタン・Esc・オーバーレイクリック（Dialog ラッパー標準）。閉じたら再表示しない |
| a11y | `role="dialog"` / `aria-modal` / フォーカストラップ / Esc は Dialog ラッパーが担保。WCAG 2.1 AA（SC-003） |
| motion | 演出は Dialog 標準に留め、`prefers-reduced-motion` を尊重する |

## テスト契約

| レイヤー | ファイル | 検証内容 |
|---------|---------|---------|
| DB 統合（Vitest） | `features/credits/server/creditRules.test.ts` | 当日初回の呼び出しは `true`、同日 2 回目は `false`。付与量・冪等性は既存テストのまま green |
| 単体（Vitest） | `DailyBonusModal.test.tsx` | ダイアログ表示・タイトル/本文（残枠あり / null 両方）・「ログを書く」の遷移先・閉じる操作 |
| Story | `DailyBonusModal.stories.tsx` | 残枠あり / 残枠 null の 2 状態 |
| E2E（Playwright） | `tests/daily-bonus-modal.spec.ts` | `bonus@example.com` でログイン → 認証ページ（`/dives`）初アクセスでモーダル表示（axe 検証込み）→「ログを書く」で `/dives/new` へ遷移しモーダルが閉じる → 別ページ遷移・リロードで再表示なし。`test@example.com`（事前付与済み）では出ない。Esc / 閉じるボタンは単体テストで担保 |

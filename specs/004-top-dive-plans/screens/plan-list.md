# ダイビング予定一覧

## メタ情報

| 項目 | 内容 |
|------|------|
| 画面ID | `plan-list` |
| 関連機能 | [004 spec.md](../spec.md)（US1 / FR-001・003〜005） |
| ルート | `/plans` |
| 認証 | 必須（未認証は `/login` にリダイレクト。`src/proxy.ts` の `APP_ROUTE_PREFIXES`） |
| 実装 | `src/app/(authenticated)/plans/page.tsx` + `features/plans/components/client/PlanList/` |

## 画面構成

- 見出し「ダイビング予定」+ 右肩に「予定を作成」ボタン（→ `/plans/new`）
- **これからの予定** セクション: 予定日昇順のカード一覧。各カードは `/plans/[id]` へのリンク
- **終了済み** セクション: 予定日が JST の今日より前の予定。テキストバッジ「終了済み」付き（色だけに依存しない）

## カードの表示項目

| 項目 | 内容 |
|------|------|
| 予定日 | `YYYY/MM/DD` 形式 |
| ポイント名 | `location` |
| 残り日数 | 0 =「今日」、正 =「あとN日」（終了済みは非表示） |

## 状態

| 状態 | 表示 |
|------|------|
| 0 件 | 破線ボックス +「次のダイビングを計画しよう」CTA → `/plans/new`（FR-001） |
| データ取得失敗 | `listPlans` が throw → `error.tsx` |

## 挙動

- 「終了済み」判定はステータスカラムではなく `daysUntil(plannedOn, todayInJst()) < 0` の導出（research.md Decision 4）
- セクションは `aria-labelledby` で region 化
- 各カードに「ログに記録する」導線（024 で追加）。表示条件は `canMovePlanToLog`（予定日が当日以前）。詳細は [specs/024-plan-to-log](../../024-plan-to-log/spec.md) を参照

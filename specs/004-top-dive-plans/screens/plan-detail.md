# ダイビング予定 詳細（持ち物リスト）

## メタ情報

| 項目 | 内容 |
|------|------|
| 画面ID | `plan-detail` |
| 関連機能 | [004 spec.md](../spec.md)（US1・US3 / FR-004〜005・010〜014） |
| ルート | `/plans/[id]` |
| 認証 | 必須。他人の id / 存在しない id は 404（RLS により `getPlan` が null） |
| 実装 | `src/app/(authenticated)/plans/[id]/page.tsx` + `features/plans/components/client/PackingList/` + `DeletePlanButton/` |

## 画面構成

### 予定情報カード

- 予定日（`YYYY/MM/DD`）+ 状態バッジ（「終了済み」/「今日」/「あとN日」）
- ポイント名（h1）/ メモ（whitespace-pre-wrap）
- 「編集」リンク（→ `/plans/[id]/edit`）+ 削除ボタン
- 「ログに記録する」導線（024 で追加）。表示条件は `canMovePlanToLog`（予定日が当日以前）。詳細は [specs/024-plan-to-log](../../024-plan-to-log/spec.md) を参照

### 持ち物リスト（h2 セクション）

| 要素 | 内容 |
|------|------|
| 進捗 | 「{checked} / {total} 準備済み」を `aria-live="polite"` で表示。全件チェック時は「準備完了」を併記 |
| チェックリスト | `<ul>` + native checkbox + label。position 昇順 |
| 項目削除 | 各行の削除ボタン（`aria-label="{name} を削除"`） |
| カスタム追加 | FormField + 追加ボタン（`packingItemSchema`: 1〜60 文字） |

## 挙動

- チェック / 追加 / 削除は Server Action（`togglePackingItem` / `addPackingItem` / `deletePackingItem`）→ 成功で `router.refresh()`。**楽観更新なし**（research.md Decision 3）。操作中は対象を `disabled`
- 追加項目の `position` は末尾採番
- 予定の削除は確認ダイアログ（持ち物も一緒に消える旨を明記）→ 成功で `/plans` へ。持ち物は FK `on delete cascade` で連動削除（FR-014）
- Action 失敗は `role="alert"` でリスト近傍に表示

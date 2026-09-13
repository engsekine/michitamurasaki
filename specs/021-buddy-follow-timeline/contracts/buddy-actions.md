# Contract: バディ記録・除去

バディの保存は Dive 保存フロー（`features/dives/server/actions.ts`）に内包。本人によるタグ除去は専用 Action。

## バディの差分同期（Dive 保存内）

| 項目 | 内容 |
|---|---|
| 入力 | `diveId`, `buddies: { userId?: string; name?: string; nickname?: string }[]`（`nickname` は編集画面のチップ表示専用で xor 判定・保存には不使用） |
| 検証（yup） | 各要素は `userId` か `name` のいずれか一方必須。`name` は trim 後 1〜100 文字。自分自身（`userId === auth.uid()`）は不可 |
| 動作 | 既存 `dive_log_buddies`（当該 dive・`removed_by_buddy=false`）と入力を比較し、追加＝INSERT / 削除＝DELETE。`removed_by_buddy=true` の行は対象外（再追加不可・FR-024b） |
| 権限 | dive 所有者のみ（RLS insert/delete ポリシー） |
| 出力 | Dive 保存の `ActionResult`。同期が一部失敗しても本体保存は巻き戻さず、`createDive`/`updateDive` が `buddyWarning` を返す（フォームで警告表示。編集時は遷移せず警告、作成時は詳細へ遷移） |

### エラー

- `self_buddy`: 自己タグ（トリガ + 事前チェック） → 要素単位で拒否
- `duplicate_user`: 同一登録ユーザー重複 → 部分ユニーク違反を捕捉
- `retag_blocked`: 本人除去済み相手の再タグ → INSERT 失敗を握り、UI に理由表示

> 注記: 現フェーズの実装は INSERT 失敗を汎用警告「同行バディの保存に一部失敗しました」に集約する（登録ユーザーのバディ追加 UI 未提供のため）。

## `removeBuddyTagOfSelf(buddyTagId: string)`（本人除去・FR-024a）

| 項目 | 内容 |
|---|---|
| 入力 | `buddyTagId`: 自分宛タグの行 ID |
| 前提 | `buddy_user_id === auth.uid()` |
| 動作 | `update dive_log_buddies set removed_by_buddy = true where id = buddyTagId`（RLS "buddy can opt out own tag"） |
| 出力 | `{ success: true }` |
| 効果 | 当該タグは以後どのログ閲覧経路でも非表示。所有者は削除も再追加も不可 |
| 再検証 | 対象 dive 詳細・自分のプロフィール |

## 表示（FR-004）

- `DiveBuddy.isRegistered=true` → `/users/[userId]` リンク（表示名 = nickname）
- `isRegistered=false` → 素テキスト（`buddy_name`）
- `removed_by_buddy=true` は一覧から除外（RLS でも親経由 select 時に含めない運用）

## 受け入れ基準（spec 対応）

- FR-001〜006 / FR-024・024a・024b / SC-001（30 秒以内追加）/ SC-007（1 画面で把握）

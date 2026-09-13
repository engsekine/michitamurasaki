# Contract: Server Actions（メール配信許可）

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

`auth` の `signUp` / `completeProfile` と、`account` の `getProfile` / `updateProfile` を変更。戻り値は既存 `ActionResult`。メール配信許可は**任意**のためサーバー側の必須ガードは設けない（利用規約 018 との違い）。

## `signUp(input)` 変更（auth）

| 項目 | 内容 |
|------|------|
| 入力追加 | `SignUpInput` に `emailOptIn: boolean` を追加 |
| ガード | なし（任意項目。未指定時は false 扱い） |
| 記録 | `options.data` に `email_opt_in: input.emailOptIn` を追加（`handle_new_user` がメール経路 INSERT で `is_email_opted_in` と `email_opted_in_at` を書く） |
| 既存挙動 | メール確認フロー・利用規約同意ガード等は変更なし |

## `completeProfile(input)` 変更（auth）

| 項目 | 内容 |
|------|------|
| 入力追加 | `CompleteProfileInput` に `emailOptIn: boolean` を追加 |
| 記録 | `toUserDetailsInsert` を拡張し `is_email_opted_in = input.emailOptIn` / `email_opted_in_at = input.emailOptIn ? now : null` を INSERT に含める |
| 既存挙動 | 本人 INSERT・PK 重複の冪等処理・TOP（`/`）redirect・利用規約記録は変更なし |

## `getProfile()` 変更（account）

| 項目 | 内容 |
|------|------|
| 取得列追加 | `select(...)` に `is_email_opted_in` を追加（フォーム初期値表示用、FR-007） |
| 戻り値 | `ProfileData` に `emailOptIn: boolean` を追加 |

## `updateProfile(input)` 変更（account）

| 項目 | 内容 |
|------|------|
| 入力追加 | `UpdateProfileInput` に `emailOptIn: boolean` を追加 |
| 記録ロジック | 現在値を読み、**OFF→ON** で `email_opted_in_at = now()`、**ON→OFF** で NULL、**ON 維持**は既存 `email_opted_in_at` を保持。`is_email_opted_in = input.emailOptIn` を更新（FR-006、research Decision 5） |
| 既存挙動 | 本人 UPDATE・他プロフィール列の更新は変更なし |

> `updateProfile` は現在の `email_opted_in_at` を参照して保存値を決めるため、`toUserDetailsUpdate` に現在値（または現在の opt-in 状態）を渡せるようシグネチャを拡張する。OFF→ON 判定をサーバー側で行い、クライアントの送信値だけに依存しない。

## 記録経路まとめ

| 経路 | is_email_opted_in | email_opted_in_at |
|------|-------------------|--------------------|
| メール登録（`signUp`→トリガー） | `options.data.email_opt_in` | 許可時のみ `now()` |
| Google 初回（`completeProfile`） | `input.emailOptIn` | 許可時のみ登録時刻 |
| 設定変更（`updateProfile`） | `input.emailOptIn` | OFF→ON で `now()`、ON 維持で保持、ON→OFF で NULL |

## 受け入れ対応
FR-004 / FR-005 / FR-006 / FR-007 / FR-010、SC-001 / SC-004 / SC-005

## テスト観点（Vitest）
- `signUp`: `emailOptIn=true`/`false` で `options.data.email_opt_in` に正しく渡る
- `completeProfile`: `emailOptIn=true` で INSERT に `is_email_opted_in=true` / `email_opted_in_at` 非 null、`false` で `is_email_opted_in=false` / `email_opted_in_at=null`
- `updateProfile`: OFF→ON で `email_opted_in_at` がセット / ON→OFF で null / ON 維持で既存日時保持
- `getProfile`: `emailOptIn` が戻り値に含まれる
- `toUserDetailsInsert` / `toUserDetailsUpdate`: opt-in 列が正しくマップされる

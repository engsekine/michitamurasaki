# Research: ダイビング申し込みシートのテキスト出力

**Date**: 2026-07-10 | **Feature**: [spec.md](./spec.md)

## Decision 1: 自動入力ソースのマッピング

**Decision**: 自動入力（FR-007）は以下の既存データを参照する。

| シート項目 | ソース | 備考 |
|---|---|---|
| 氏名 | `user_details.last_name` + `first_name` | サインアップ時必須のため常に存在する |
| 生年月日 / 年齢 | `user_details.birth_on` | 年齢は JST 基準で算出（`shared/lib/date` を利用） |
| 性別 | `user_details.gender` | `unanswered` の場合は空欄扱い |
| 身長 / 体重 | `user_details.height_cm` / `weight_kg` | 任意項目のため null は空欄 |
| ライセンスランク | `certifications` の最新 1 件の `rank` | 複数保有時は取得日降順の先頭（ユーザーが上書き可能なため厳密な「最上位」判定はしない） |
| 経験本数 | `dives` の件数（本人分 count） | アプリ記録前の本数は含まれないため上書き可能にする |
| 最終ダイブ年月 | `dives.dive_date` の最大値 | `YYYY-MM` としてフォーム（month 入力）へ渡し、出力時に「{年} 年 {月} 月」へ整形 |

**Rationale**: すべて既存テーブルの参照のみで実現でき、スキーマ変更は保存用の新テーブル 1 つに閉じられる。

**Alternatives considered**:
- 携帯電話を MFA（`auth.users.phone`）から流用 → MFA 登録者しか値が無く、用途も 2FA 専用のため見送り（手入力 + 保存とする）
- ドライスーツ経験を `dives.suit_type`（自由テキスト）から推定 → 表記ゆれで誤判定リスクがあるため v1 は手入力（spec Assumptions 通り）

## Decision 2: 保存先は新テーブル `application_profiles`（user 1:1）

**Decision**: 手入力の個人属性は新テーブル `public.application_profiles`（`user_id` 主キー、users と 1:1）に保存する。`user_details` は変更しない。

**Rationale**:
- 緊急連絡先・コンタクトレンズ情報などは申し込みシート専用の属性であり、汎用プロフィール（`user_details`）に混ぜるとマスタの責務が肥大する
- 1:1 テーブル分離なら RLS を「本人のみ」で完結でき、既存機能への影響がゼロ
- 身長・体重は `user_details` に既存のため保存対象外（自動入力のみ。フォームでの修正は出力にのみ反映）

**Alternatives considered**:
- `user_details` へのカラム追加 → 申し込み専用属性 10 個超で肥大するため却下
- `jsonb` 1 カラム保存 → 型・制約が効かず SQL 規約（3NF・CHECK 制約）に反するため却下

## Decision 3: フォームは Client Component + 出力生成は純関数

**Decision**: 画面は `page.tsx`（Server Component）でプリフィルデータを取得し、フォーム本体は `'use client'` の `ApplicationSheetForm` に渡す。出力テキストの組み立ては `features/application-sheet/lib/buildSheetText/` の**純関数**として実装し、Vitest で網羅的にテストする。

**Rationale**:
- 入力のたびにプレビューを更新する対話的 UI のため Client Component が必要（Constitution II の「最小範囲」に該当）
- テキスト整形ロジックを純関数に分離すれば、空欄・○ 付与・ブロック省略（FR-004/005/012)の組み合わせをコンポーネント無しで高速にテストできる
- フォームは React Hook Form + yup（プロジェクト標準）。項目数が多いためセクション分割コンポーネントに分けるが、RHF オブジェクトは直接 Props で渡さず `Controller` 経由とする（rules/react.md）

**Alternatives considered**:
- Server Action で生成してテキストを返す → 入力のたびのラウンドトリップは不要な複雑さ。生成は端末内で完結できる

## Decision 4: コピーは Clipboard API + 手動コピーのフォールバック

**Decision**: 「コピー」ボタンは `navigator.clipboard.writeText` を使い、成功時に `role="status"` の完了メッセージを表示する。生成テキストは常時 `readonly` の `textarea`（または選択可能な `pre`）で全文表示し、Clipboard API が使えない環境でも手動コピーできるようにする（spec Edge Case 対応）。

**Rationale**: 非 HTTPS・旧ブラウザで Clipboard API が失敗しても機能が成立する。`aria-live` によるフィードバックは WCAG 対応（Constitution V）。

**Alternatives considered**: `document.execCommand('copy')` フォールバック → 非推奨 API のため、選択可能な全文表示で代替する

## Decision 5: ルーティングと導線

**Decision**: ページは `app/(authenticated)/application-sheet/page.tsx` に新設し、`proxy.ts` の `APP_ROUTE_PREFIXES` に `/application-sheet` を追加する。TOP ダッシュボードの導線は `app/page.tsx` に申し込みシートへのリンクセクションを追加する（clarify: TOP に導線）。

**Rationale**: 認証必須ページ（clarify: ログイン済み前提）は `(authenticated)` グループ + proxy prefix が確立済みパターン。導線は 030 の `GuideIntroSection` と同じ「app 層で組み立てて注入」方式を踏襲する。

**Alternatives considered**: ヘッダーナビへの追加 → clarify で TOP ダッシュボード導線に確定済み

## Decision 6: 出力フォーマットの正規形

**Decision**: ユーザー提供の依頼文サンプルを正規形としてテンプレート定数（`constants.ts` の `SHEET_TEMPLATE` 相当）に定義し、生成関数はこの並び・ラベルを唯一の情報源とする。値が空の項目は `（ ）` の空欄のまま出力する。レンタル品目は選択項目に `○` を付け、`ウエットスーツフルセット: ○` の形式とする。

**Rationale**: フォーマットの単一情報源化により、FR-004（並び・体裁の一致）と SC-002（全 19 項目の網羅）をテンプレート定数へのテストで担保できる。

**Alternatives considered**: ショップごとのテンプレート編集 → spec でスコープ外と明記済み

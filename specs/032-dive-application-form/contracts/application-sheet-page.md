# Contract: 申し込みシート作成ページ

**Feature**: [spec.md](../spec.md) | **Design**: [research.md](../research.md) / [data-model.md](../data-model.md)

## ルーティング

| 項目 | 内容 |
|---|---|
| パス | `/application-sheet`（`?sheet=<id>` で保存済みシートを開く。UUID 以外・他人のシートは新規作成として扱う） |
| 配置 | `service-front/src/app/(authenticated)/application-sheet/page.tsx` |
| 認証 | 必須。`proxy.ts` の `APP_ROUTE_PREFIXES` に `/application-sheet` を追加する（未認証は `/login` へ） |
| metadata | `generatePageMetadata` を使用し `noIndex: true`（個人情報を扱う認証ページのため） |
| レイアウト | `Header` / `Footer` を含む（`(authenticated)/layout.tsx` に準拠） |

## 導線（FR-001）

| 場所 | 内容 |
|---|---|
| TOP ダッシュボード（`app/page.tsx`） | `ApplicationSheetIntroSection`（feature の Server Component）を配置。見出し・機能ポイント 3 点・「申し込みシートを作る」導線に加え、登録内容（プリフィル）から実際に生成したテキストのプレビューを表示する |

## コンポーネント構成

| コンポーネント | 種別 | 責務 |
|---|---|---|
| `ApplicationSheetForm` | Client Component | フォーム全体（RHF + yup）・プレビュー・シート名付き保存（新規/上書き）・基本情報の保存（FR-014）の統括。レンタル「無」時は身長・体重・足のサイズ・コンタクトレンズの有無と種類・度付きマスクを、ドライスーツ経験「有」以外では経験本数を非表示にする（FR-011） |
| `SavedSheetList` | Client Component | 保存済みシートの一覧（名前・更新日時・更新順）。`?sheet=<id>` リンクで選択、削除ボタン（confirm 付き）で削除（FR-010） |
| `RentalItemsField` | Client Component | レンタル有無 + 品目 14 種の選択（「有」時のみ品目を表示・「無」時は省略トグルを表示。FR-011/012）。有無のデフォルトは「無」で、「無」選択時は親（Form）が省略トグルを自動 ON にする |
| `SheetPreview` | Client Component | 生成テキストの全文表示 + 直接編集（FR-013）+ コピーボタン + `role="status"` の完了通知。手動編集後はフォーム由来の再生成に追従せず、「フォームの内容から再生成」ボタンで戻せる |
| `buildSheetText` | 純関数（lib） | フォーム値 → 定型テキスト生成（FR-004/005/012） |
| `toSheetDefaultValues` | 純関数（lib） | プリフィル → 新規シートのフォーム初期値（`Partial<SheetFormValues>`）変換。null の項目はキーごと省く（FR-009） |
| `sheetToFormValues` | 純関数（lib） | 保存済みシートの DB 行 → フォーム値（スナップショット全体）変換。未知のレンタル品目キーは除外する |

## サーバー契約

### `getApplicationSheetPrefill()`（server/queries.ts）

| 項目 | 内容 |
|---|---|
| 入力 | なし（認証ユーザーのコンテキスト） |
| 出力 | `{ fullName, birthOn, age, gender, heightCm, weightKg, licenseRank, diveCount, lastDiveYearMonth, phone, emergencyContactRelation, emergencyContactPhone, nearestStation, hasDrySuitExperience, drySuitDiveCount }` |
| 挙動 | `user_details` / `certifications` / `dives` / `application_sheets`（kind='base'）を並列参照し、未登録項目は null で返す（FR-007/009）。保存済み基本情報（経験含む）は資格・ログ・プロフィール由来の値より優先し、空欄はそれらで補完。`age` は `birth_on` から JST 基準で算出。`gender` の `unanswered` は null（空欄扱い）。`diveCount` は 0 件なら null。`lastDiveYearMonth` は `max(dive_date)` の `YYYY-MM`。新規シートの初期値にのみ使う |

### `listApplicationSheets()`（server/queries.ts）

| 項目 | 内容 |
|---|---|
| 出力 | `SavedSheetSummary[]`（`{ id, name, updatedAt }`・更新日時の降順） |
| 挙動 | RLS により本人のシートのみ。kind='sheet' に限定（基本情報の行は一覧に出さない） |

### `getApplicationSheet(sheetId)`（server/queries.ts）

| 項目 | 内容 |
|---|---|
| 出力 | `{ id, name, values: SheetFormValues } \| null` |
| 挙動 | UUID 形式でない ID は DB を参照せず null。RLS により他人のシート・kind='base' の行は null（新規作成として扱われる） |

### `saveApplicationBaseProfile(values)`（server/actions.ts・Server Action）

| 項目 | 内容 |
|---|---|
| 入力 | フォーム全体（yup で再バリデーション。基本情報 + 経験の項目のみ保存する） |
| 挙動 | `application_sheets` の kind='base' 行へ upsert（1 ユーザー 1 件・固定名「基本情報」・一覧非表示）。新規シート作成時の自動入力に使う（FR-014） |
| 認可 | RLS + 本人チェック |

### `saveApplicationSheet({ sheetId, name, values })`（server/actions.ts・Server Action）

| 項目 | 内容 |
|---|---|
| 入力 | `sheetId`（null = 新規）・シート名・フォーム全体（yup で再バリデーション） |
| 挙動 | 新規は insert（上限 20 件を超えるとエラー）、`sheetId` 指定時は本人のシートに限定して update。シート名は必須・50 文字以内。成功時は `{ id }` を返す（FR-010） |
| 認可 | RLS + `user_id` の明示チェック。他ユーザーのシートは更新できない |

### `deleteApplicationSheet(sheetId)`（server/actions.ts・Server Action）

| 項目 | 内容 |
|---|---|
| 挙動 | 本人のシートに限定して削除し、`/application-sheet` を revalidate する |
| 認可 | RLS + `user_id` の明示チェック |

## 出力テキスト契約（FR-004 / SC-002）

依頼文サンプルを正規形とし、以下の並びで出力する。値が空の項目は括弧内を空欄のまま出す。

```text
・お名前（{氏名}）
・年齢（{年齢} 歳）
・生年月日（西暦 {年} 年 {月} 月 {日} 日）
・性別（{性別}）
・携帯電話（{携帯電話}）
・緊急連絡先 続柄（{続柄}）（{電話番号}）
・最寄りの駅（{駅}）
・ライセンス ランク（{ランク}）
・経験本数（{本数} 本）
・最終ダイブ年月（{年} 年 {月} 月）
・ドライスーツの経験（{有/無}）
・ドライの経験本数 約（{本数} 本）

・レンタル器材（{有/無}）

ありの場合レンタルしたいものに○を付けてください

ウエットスーツフルセット: {○}
ドライスーツフルセット: {○}
マスク スノーケル: {○}
フィン: {○}
グローブ: {○}
ブーツ: {○}
ウエットスーツ: {○}
ウエットベスト: {○}
ドライスーツ: {○}
BC: {○}
レギュレーター: {○}
ダイビングコンピューター: {○}
水中ライト: {○}
水中カメラ: {○}

・ウェット・ドライスーツレンタルの方
身長:{身長} cm
体重:{体重} kg
足のサイズ:{足サイズ} cm

・コンタクトレンズ有無（{有/無}）
有りの方 → ハード or ソフト or 使い捨て（{種類}）

・度付きのマスクレンタル必要の有無（{要/不要}）
```

- 選択したレンタル品目のみ `○` を付ける（`品目名: ○`）。未選択は `品目名:` のみ（末尾スペースなし）
- 未入力の括弧は `（ ）`（半角スペース 1 つ）、単位付きは `（ 歳）` `（ 本）` のように単位を残す。生年月日は `（西暦 年 月 日）`、最終ダイブ年月は `（ 年 月）`。身長・体重・足のサイズは `身長:{値} cm` 形式（コロン直後に値）。未入力は `身長: cm` とラベル・単位のみ残す
- 月・日はゼロ埋めなし（`05` → `5`）で出力する
- 最終ダイブ年月はフォームでは「2026年7月」形式のテキスト入力（DB は YYYY-MM で保持し `yearMonth` lib で相互変換）
- 伊豆・千葉でのダイビング経験・ボートダイビングの経験の行は 2026-07-11 に廃止
- コンタクトの種類はコンタクト「有」のときだけ出力し、それ以外は空欄（ ）にする
- レンタル「無」+ 省略トグル ON のとき、「ありの場合〜」から品目一覧・サイズ欄・コンタクトレンズ有無（種類の行含む）・度付きマスクまでのブロックをすべて出力から除き、テキストは「・レンタル器材（無）」で終わる（FR-012）。「有」時はトグルに関係なく省略しない
- デフォルトは「無」+ 省略トグル ON（＝省略された短い出力）。「無」を選び直すたびにトグルは自動で ON になる（手動で OFF に戻せる）
- プレーンテキスト（改行 `\n`）。メール・LINE 貼り付けで崩れないこと

## アクセシビリティ契約（Constitution V）

- フォーム項目はすべて `label` 関連付け・エラーは `role="alert"` + `aria-invalid`
- 有無の選択はラジオ / チェックボックスのネイティブ要素で実装しキーボード操作可能にする
- コピー完了通知は `role="status"`（`aria-live="polite"`）
- 見出し階層 h1 → h2（セクション: 基本情報（経験の項目を含む） / レンタル器材 / 出力 / シートの保存）

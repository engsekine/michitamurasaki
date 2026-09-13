---
name: sync-spec
description: 変更コードと仕様書（specs/ 配下の spec-kit 形式仕様書）の整合性をチェックし、ずれを検出した場合は仕様書を更新する。
user-invocable: true
argument-hint: "[対象ファイルパス]"
---

変更コードと仕様書のドリフトを検出して、仕様書側を実装に合わせて更新する。

## 使い方

- `/sync-spec` — 現在のブランチの全変更ファイルを対象にチェック + 修正
- `/sync-spec $ARGUMENTS` — 指定ファイルのみを対象にチェック + 修正（例: `src/features/dives/schemas/dive.schema.ts`）

## 前提

- 仕様書は **spec-kit 形式** で `specs/` 配下に配置されている
  - `specs/<NNN>-<name>/spec.md` — 要件（ユーザーストーリー / FR / Success Criteria）
  - `specs/<NNN>-<name>/plan.md` — 実装計画（技術選定・設計詳細）
  - `specs/<NNN>-<name>/tasks.md` — タスク分解
  - `specs/<NNN>-<name>/data-model.md` — テーブル仕様（カラム / 制約 / RLS / トリガー）
  - `specs/<NNN>-<name>/screens/<name>.md` — 画面仕様（補助ドキュメント）
- 旧 `docs/specs/` は `specs/` へ移行完了し削除済み（同期対象は `specs/` のみ）
- 仕様書は **実装に合わせて更新する**（実装が真実）。逆方向（仕様書通りに実装を直す）は本スキルの対象外

## 手順

### 1. 対象差分の取得

引数 `$ARGUMENTS` が指定されている場合は指定ファイルのみ対象。

引数がない場合は [.claude/rules/diff-scope.md](../../rules/diff-scope.md) に従い、未ステージ・ステージング済み・コミット済みの 3 層を統合した変更ファイル一覧を取得する。

差分がなければ「同期対象のファイルがありません」と出力して終了。

### 2. 影響を受ける仕様書の特定

各変更ファイルに対し、以下のマッピングで関連仕様書候補を列挙する。`src/...` のパターンはワークスペースプレフィックス（`service-front/` / `admin-front/`）を除いた相対パスとして照合する（diff-scope.md の「モノレポのパスプレフィックス」参照）:

| 変更ファイルのパターン | 対応する仕様書 |
|----------------------|--------------|
| `src/features/<feature>/components/client/<Comp>/<Comp>.tsx` | `specs/<NNN>-<feature>/screens/<関連画面>.md`（フォーム項目 / 表示要素） |
| `src/features/<feature>/schemas/*.schema.ts` | `specs/<NNN>-<feature>/screens/*.md` の「項目定義」「バリデーション」表、`spec.md` の Functional Requirements |
| `src/features/<feature>/server/queries.ts` / `actions.ts` | `specs/<NNN>-<feature>/plan.md`（データ取得方針） |
| `src/features/<feature>/lib/*.ts` | `specs/<NNN>-<feature>/screens/*.md`（自動計算等の挙動説明） |
| `src/features/<feature>/constants.ts` | `specs/<NNN>-<feature>/screens/*.md`（選択肢一覧） |
| `src/app/<route>/page.tsx` | `specs/<NNN>-<feature>/screens/<route 対応>.md` |
| `src/proxy.ts` / `src/middleware.ts` | `specs/<NNN>-<feature>/plan.md`（ルーティング） |
| `supabase/migrations/<ts>_<verb>_<table>.sql` | `specs/<NNN>-<feature>/data-model.md` |

`specs/` が存在しない、またはマッピング先が見つからない場合はそのファイルをスキップ。

### 3. ドリフト検出

仕様書候補ごとに **Read** して、以下のカテゴリで実装との差分を検出:

| カテゴリ | 検出例 |
|---|---|
| **UI コントロール種別** | spec が `select` のままだが実装は `<input type="text">` |
| **バリデーション値** | spec の `max 50 文字` に対し実装は `max(40)` |
| **必須 / 任意** | spec が「必須」だが実装は `nullable()` |
| **デフォルト値** | spec が「今日」だが実装は「JST の今日」/ ロジック変更 |
| **エラーメッセージ** | 実装の文言と spec の文言が一致しない |
| **項目の追加 / 削除** | 実装にあるカラム・項目が spec に無い、またはその逆 |
| **挙動の追記漏れ** | 自動計算 / 自動入力など実装にあるが spec に書かれていない |
| **ラベル** | UI ラベルと spec の項目名がズレ |
| **ルート / 認証** | proxy.ts の `APP_ROUTE_PREFIXES` 変更が spec の「認証」欄に未反映 |
| **DB スキーマ** | マイグレーション SQL の制約 / 型と `data-model.md` の記述が齟齬 |

### 4. 修正の適用

検出したドリフトを以下の方針で処理:

| ドリフト種別 | 対応 |
|---|---|
| 値の不一致（数字 / 文字列） | **Edit ツールで spec を実装に合わせて修正** |
| 項目の追加 | **Edit で行を追加** |
| 項目の削除 | **Edit で行を削除**。ただし「将来用に残す」意図がコメントで明記されている場合は残す |
| 挙動の追記漏れ | **Edit で補足列 / セクションに追記** |
| 大規模な構造変更（セクション分割など） | **Write で全面書き換え**（ユーザーに事前確認） |

**修正しない例外**:
- 仕様書側に意図的に「TBD」「ドラフト」とマークされていて、実装が暫定の場合 → 報告のみ
- 過去の意思決定として明示的に "あえて齟齬を残す" コメントがある場合 → 報告のみ

### 5. 結果サマリー

```
仕様書同期レポート
═══════════════════════════
対象差分: <変更ファイル数>件
照合した仕様書: <パスの一覧>

修正したドリフト: <件数>件
- [仕様書パス:行番号] [変更前] → [変更後]（理由: <実装ファイル>）
...

修正をスキップした項目: <件数>件
- [仕様書パス:行番号] [理由: TBD / 意図的な齟齬 等]

ずれなし: <ファイル数>件
```

### 6. 仕様書を更新したらタスクファイルも確認

`specs/<NNN>-<feature>/tasks.md` に「仕様書を XX に書き換える」というタスクがあって、その内容を今回反映したなら、対応するチェックボックスを完了に更新する（`[ ]` → `[x]`）。

## 自動起動

`.claude/CLAUDE.md` の「仕様書同期ルール」により、コード編集後に自動的に本スキルの確認が促される。明示的に走らせたいときは `/sync-spec` で実行可能。

## $ARGUMENTS

指定ファイルパス（省略可）。省略時は変更差分全体が対象。

例:
- `/sync-spec`
- `/sync-spec src/features/dives/schemas/dive.schema.ts`
- `/sync-spec supabase/migrations/20260605120000_add_regulators.sql`

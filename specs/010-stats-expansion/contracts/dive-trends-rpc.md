# Contract: 統計推移 RPC とアプリ層の境界

本 feature が公開するインターフェースは Supabase RPC 2 つと、dashboard feature 内のクエリ関数 2 つ。定義の詳細は [data-model.md](../data-model.md) を参照（ここでは契約のみ記す）。

## RPC 契約

### get_dive_yearly_counts

| 項目 | 内容 |
|---|---|
| 引数 | なし |
| 戻り値 | `{ year: number, dive_count: number }[]`（year 昇順） |
| 認可 | `security invoker`。本人限定は関数内の `where user_id = (select auth.uid())` が保証する（RLS は 021 の公開読み取りポリシー以降、他人の公開ログも可視にするため単独では不十分） |
| 0 件時 | 空配列（エラーにしない） |
| 不変条件 | `dive_count >= 1`（0 本の年は行を返さない） |

### get_dive_monthly_stats

| 項目 | 内容 |
|---|---|
| 引数 | `months_back: number`（省略時 12。1 未満は 1 として扱う） |
| 戻り値 | `{ month: 'YYYY-MM', dive_count: number, avg_water_temp_c: number \| null, max_depth_m: number }[]`（month 昇順） |
| 期間 | 現在月を含む直近 `months_back` ヶ月。RPC の基準月は DB の UTC 日付のため、JST 1 日 0:00〜8:59 は 1 ヶ月手前から始まるスーパーセットを返しうる（アプリ側 `fillMonthlyGaps` が余分な月を捨てるため表示には影響しない） |
| 認可 | `security invoker`。本人限定は関数内の `where user_id = (select auth.uid())` が保証する（RLS は 021 の公開読み取りポリシー以降、他人の公開ログも可視にするため単独では不十分） |
| 0 件時 | 空配列 |
| 不変条件 | `dive_count >= 1`。`avg_water_temp_c` は水温入力ログが 0 件の月のみ null |

## クエリ関数契約（`features/dashboard/server/queries.ts`）

```typescript
/** 年別本数。歯抜け年は 0 埋め済み（最古年〜最新年）。ログ 0 件は [] */
getYearlyDiveCounts(): Promise<YearlyDiveCount[]>

/** 直近 12 ヶ月の月別統計。歯抜け月は diveCount 0 / 水温・深度 null で 0 埋め済み。ログの有無に関わらず常に 12 要素 */
getMonthlyDiveStats(): Promise<MonthlyDiveStat[]>
```

- **空状態の判定はログ全体の有無（= `getYearlyDiveCounts()` が `[]` かどうか）で行う**。年別は全期間を対象とするため `[]` ⇔ ログ 0 件。直近 12 ヶ月にログがない既存ユーザーでも、月別は 12 要素の 0 本列として表示する（FR-003。月別の中身では空状態を判定しない）

- RPC エラー時は `Error` を throw（メッセージ形式は既存 `getDiveStats` に倣い `[関数名] supabase error: ...`）
- 0 埋めは `lib/trends.ts` の純粋関数に委譲する:

```typescript
/** 最古年〜最新年の連続列に補完。rows が空なら [] */
fillYearlyGaps(rows: YearlyDiveCount[]): YearlyDiveCount[]

/** baseMonth（'YYYY-MM'）から遡る months 個の連続列に補完。rows が空でも常に months 要素を返す（無条件 0 埋め） */
fillMonthlyGaps(rows: MonthlyDiveStat[], baseMonth: string, months: number): MonthlyDiveStat[]
```

## UI 契約（共有チャートコンポーネント）

```typescript
// src/shared/components/chart/BarChart
interface BarChartProps {
    /** x 軸ラベルと値の列。値 0 は高さ 0 の棒として描画 */
    items: { label: string; value: number }[];
    /** SVG 全体の要約（aria-label） */
    description: string;
}

// src/shared/components/chart/LineChart
interface LineChartProps {
    /** value が null の点は欠測として線を分断する（0 と区別） */
    items: { label: string; value: number | null }[];
    description: string;
    /** 値の単位表示（例: '℃' / 'm'） */
    unit?: string;
}
```

- 両者とも Server Component。`<svg role="img" aria-label={description}>` を出力し、イベントハンドラを持たない
- items が 1 件のみでも描画が破綻しないこと（単一点）を契約とする

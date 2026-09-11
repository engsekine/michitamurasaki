-- ========================================
-- dive_plans.planned_on に日付範囲 CHECK を追加（セキュリティ監査対応 2026-09）
--
-- 問題: planned_on に範囲制約が無く、Server Action の直接呼び出しで '9999-12-31' 等の
--       極端な日付を保存できた（TOP の「次の予定」・リマインド生成の前提が崩れる）。
--
-- 対応: dives.dive_date 等と同様の現実的な範囲に限定する。既存行の影響を避けるため `not valid` で追加する。
-- ========================================

alter table public.dive_plans
    add constraint dive_plans_planned_on_range_check
        check (planned_on between '1900-01-01' and '2100-12-31') not valid;

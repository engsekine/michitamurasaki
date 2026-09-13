-- ========================================
-- 忘れ物確認機能（037-forgotten-item-check）
-- 持ち物準備の完了状態と、忘れ物確認（2 周目チェック）の確認状態を追加する。
-- 新規テーブルはなし。既存 RLS（本人のみ CRUD）がそのまま適用される。
-- 仕様: specs/037-forgotten-item-check/data-model.md
-- ========================================

alter table public.dive_plans
    add column packing_completed_at timestamptz;

comment on column public.dive_plans.packing_completed_at is
    '持ち物準備の完了日時（037）。null = 未完了。値あり = 完了中（忘れ物確認リストを表示）。解除で null に戻す';

alter table public.plan_packing_items
    add column is_confirmed boolean not null default false;

comment on column public.plan_packing_items.is_confirmed is
    '忘れ物確認（2 周目チェック）の確認状態（037）。準備チェック is_checked とは独立。完了解除時に全件 false へ戻す';

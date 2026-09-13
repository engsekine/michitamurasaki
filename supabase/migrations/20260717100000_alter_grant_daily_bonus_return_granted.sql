-- ========================================
-- デイリーボーナス獲得モーダル（036）: grant_daily_bonus の返り値を boolean 化
--
-- 付与が実際に発生したか（true = この呼び出しで付与 / false = 当日分付与済み）を
-- 呼び出し元へ返し、獲得モーダルの表示判定（036 FR-001）に使う。
-- 付与ロジック・冪等性・並行安全性（026 FR-003 / 部分ユニーク制約）は一切変更しない。
-- 既存の呼び出し元（authenticated layout）は返り値を無視していたため後方互換。
--
-- 返り値型の変更は create or replace では行えないため drop + create で作り直す。
-- 権限・コメントも再設定する。
-- ========================================

drop function if exists public.grant_daily_bonus();

create function public.grant_daily_bonus()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := (select auth.uid());
begin
    if v_user_id is null then
        raise exception 'authentication required' using errcode = '28000';
    end if;

    begin
        perform public.apply_credit_ledger_entry(
            v_user_id,
            'daily_bonus',
            1,
            (now() at time zone 'Asia/Tokyo')::date
        );
    exception
        when unique_violation then
            -- 当日分は付与済み（部分ユニークにより並行呼び出しでも 1 回のみ）
            return false;
    end;

    return true;
end;
$$;

comment on function public.grant_daily_bonus() is
    'デイリーボーナス（当日 JST 分のログ枠 +1）を冪等に付与する。返り値は付与発生の有無（true = この呼び出しで付与 / false = 付与済み）。獲得モーダル（036）の表示判定に使用';

revoke all on function public.grant_daily_bonus() from public;
grant execute on function public.grant_daily_bonus() to authenticated;

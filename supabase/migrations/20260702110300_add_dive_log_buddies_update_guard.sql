-- ========================================
-- dive_log_buddies の UPDATE を removed_by_buddy のみに制限するトリガ（セキュリティ監査対応）
--
-- 問題: "buddy can opt out own tag" ポリシー（20260630100000）は行単位の条件のみで
--       カラムを制限しないため、タグ付けされた本人が自分のタグ行の dive_id を
--       既知の任意ダイブ ID に付け替え、他人のログに「同行者」として自己記載できる
--       （prevent_self_buddy は所有者一致のみ検査、FK・部分ユニークも防がない）。
--
-- 対応: UPDATE では removed_by_buddy 以外のカラム変更を禁止する
--       （現状の正当な UPDATE 経路はバディ本人のオプトアウトのみ）。
-- 仕様: specs/021-buddy-follow-timeline/data-model.md
-- ========================================

create or replace function public.enforce_buddy_optout_only_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.id is distinct from old.id
       or new.dive_id is distinct from old.dive_id
       or new.buddy_user_id is distinct from old.buddy_user_id
       or new.buddy_name is distinct from old.buddy_name
       or new.created_at is distinct from old.created_at then
        raise exception 'only removed_by_buddy can be updated on dive_log_buddies';
    end if;
    return new;
end;
$$;

comment on function public.enforce_buddy_optout_only_update() is
    'dive_log_buddies の UPDATE を removed_by_buddy の変更のみに制限する（タグの付け替え・改名を防ぐ）';

create trigger dive_log_buddies_enforce_optout_only
    before update on public.dive_log_buddies
    for each row execute function public.enforce_buddy_optout_only_update();

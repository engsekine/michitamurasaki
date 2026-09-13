-- ========================================
-- 予定・ログ・申し込みシートへのショップ紐付け
-- dives / dive_plans / application_sheets に dive_shop_id を追加する。
-- ショップ削除時は on delete set null で紐付けのみ解除される（FR-010）。
-- 仕様: specs/033-dive-shops/data-model.md
-- ========================================

alter table public.dives
    add column dive_shop_id uuid references public.dive_shops(id) on delete set null;

alter table public.dive_plans
    add column dive_shop_id uuid references public.dive_shops(id) on delete set null;

alter table public.application_sheets
    add column dive_shop_id uuid references public.dive_shops(id) on delete set null;

comment on column public.dives.dive_shop_id is 'このログで利用したショップ（任意・本人のショップのみ）';
comment on column public.dive_plans.dive_shop_id is 'この予定で利用するショップ（任意・本人のショップのみ）';
comment on column public.application_sheets.dive_shop_id is '保存シートの宛先ショップ（任意・kind=sheet の行で使用）';

create index idx_dives_dive_shop_id on public.dives(dive_shop_id);
create index idx_dive_plans_dive_shop_id on public.dive_plans(dive_shop_id);
create index idx_application_sheets_dive_shop_id on public.application_sheets(dive_shop_id);

-- FK 制約だけでは他人のショップ id を設定できてしまうため、
-- dive_shop_id 設定時に対象行の user_id とショップの所有者が一致することを検証する
create or replace function public.ensure_dive_shop_owned()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.dive_shop_id is not null and not exists (
        select 1
        from public.dive_shops s
        where s.id = new.dive_shop_id
          and s.user_id = new.user_id
    ) then
        raise exception 'dive_shop_id % is not owned by user %', new.dive_shop_id, new.user_id;
    end if;
    return new;
end;
$$;

create trigger dives_ensure_dive_shop_owned
    before insert or update of dive_shop_id on public.dives
    for each row
    execute function public.ensure_dive_shop_owned();

create trigger dive_plans_ensure_dive_shop_owned
    before insert or update of dive_shop_id on public.dive_plans
    for each row
    execute function public.ensure_dive_shop_owned();

create trigger application_sheets_ensure_dive_shop_owned
    before insert or update of dive_shop_id on public.application_sheets
    for each row
    execute function public.ensure_dive_shop_owned();

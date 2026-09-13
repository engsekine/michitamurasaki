-- ========================================
-- certifications.dive_id の所有検証トリガ（セキュリティ監査対応 2026-09）
--
-- 問題: certifications の RLS は user_id のみを検証し、dive_id（取得時のダイブ）が
--       本人のログかを見ていなかった。他人の dive ID（公開ログで判明）や推測 UUID を
--       設定でき、FK 違反の有無で「その UUID の dive が存在するか」（非公開でも）を
--       判定するオラクルになるほか、表示側で JOIN すると他人の公開ログが自分の資格に
--       紐づいて見えていた。
--
-- 対応: dive_shops と同方式（20260712170100 の ensure_dive_shop_owned）のトリガで、
--       dive_id が設定されるときは本人所有の dive であることを検証する。
--
-- 仕様: specs/006-diving-certifications/data-model.md
-- ========================================

create or replace function public.ensure_certification_dive_owned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.dive_id is not null and not exists (
        select 1
        from public.dives d
        where d.id = new.dive_id
          and d.user_id = new.user_id
    ) then
        raise exception 'dive_id % is not owned by user %', new.dive_id, new.user_id;
    end if;
    return new;
end;
$$;

comment on function public.ensure_certification_dive_owned() is
    'certifications.dive_id が本人所有の dive を指すことを保証する（他人のログの紐付け・存在オラクルを防ぐ）';

create trigger certifications_ensure_dive_owned
    before insert or update of dive_id, user_id on public.certifications
    for each row
    execute function public.ensure_certification_dive_owned();

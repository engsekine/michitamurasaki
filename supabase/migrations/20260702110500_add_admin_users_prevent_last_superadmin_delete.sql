-- ========================================
-- 最後の superadmin の物理削除を防ぐトリガ（セキュリティ監査対応）
--
-- 問題: 20260620100600 の保護トリガは before update のみで、
--       "superadmins manage admin users" ポリシー（for all）は DELETE も許可するため、
--       最後の有効な superadmin 行を物理 DELETE すると保護をすり抜けて
--       superadmin が 0 人になり管理権限を全喪失できる
--       （admin_audit_logs.actor_id の on delete restrict は監査ログ 0 件の管理者には効かない）。
--
-- 仕様: specs/015-admin-panel/spec.md FR-015
-- ========================================

create or replace function public.prevent_last_superadmin_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if old.role = 'superadmin' and old.is_active then
        if not exists (
            select 1
            from public.admin_users a
            where a.role = 'superadmin'
              and a.is_active
              and a.id <> old.id
        ) then
            raise exception '最後の上位管理者は削除できません';
        end if;
    end if;
    return old;
end;
$$;

comment on function public.prevent_last_superadmin_delete() is
    '有効な superadmin が 0 人になる物理 DELETE を拒否する（update 経路は 20260620100600 のトリガが担当）';

create trigger admin_users_prevent_last_superadmin_delete
    before delete on public.admin_users
    for each row
    execute function public.prevent_last_superadmin_delete();

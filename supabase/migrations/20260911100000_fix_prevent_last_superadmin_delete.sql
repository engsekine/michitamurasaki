-- ========================================
-- prevent_last_superadmin_delete の修正（セキュリティ監査対応 2026-09）
--
-- 問題: 20260702110500 の関数が存在しない列 old.is_active を参照していた
--       （admin_users の有効判定列は deleted_at）。PL/pgSQL はレコード列を実行時に解決するため
--       マイグレーションは成功していたが、admin_users への DELETE は role を問わず
--       `record "old" has no field "is_active"` で全て失敗していた。
--       fail-closed ではあるが FR-015 の保護は設計どおり動いておらず、
--       auth.users からの on delete cascade も失敗するため管理者アカウントを削除できなかった。
--
-- 対応: 有効判定を deleted_at is null に修正し、20260620100600（update 側）と同じく
--       行ロックで同時実行を直列化する。security definer にして RLS に依存せず
--       他の superadmin を数える（cascade 経路など呼び出しロールが異なる場合にも正しく判定する）。
--
-- 仕様: specs/015-admin-panel/spec.md FR-015
-- ========================================

create or replace function public.prevent_last_superadmin_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    other_active_superadmins integer;
begin
    if old.role = 'superadmin' and old.deleted_at is null then
        -- 自分以外の有効な superadmin を行ロックして同時実行を直列化する
        perform 1
        from public.admin_users
        where role = 'superadmin'
          and deleted_at is null
          and id <> old.id
        for update;
        get diagnostics other_active_superadmins = row_count;

        if other_active_superadmins = 0 then
            raise exception '最後の上位管理者は削除できません';
        end if;
    end if;
    return old;
end;
$$;

comment on function public.prevent_last_superadmin_delete() is
    '有効な superadmin が 0 人になる物理 DELETE を拒否する（update 経路は 20260620100600 のトリガが担当）';

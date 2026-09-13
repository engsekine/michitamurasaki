'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/features/admin-auth';
import { mapMutationError } from '@/shared/lib/resource/errors';
import { hardDeleteRow, softDeleteRow } from '@/shared/lib/resource/mutations';
import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

import { ALLOWED_TABLES, isAllowedTable } from '../constants';

/**
 * 汎用テーブルの行を削除する（FR-017）。
 * 許可リスト外・削除不可テーブル（user_details）は拒否。
 * on delete cascade の子を持つテーブルは参照件数を確認し、参照ありはブロックする
 * （cascade は FK 23503 にならず子行が無警告で連鎖削除されるため / FR-014）。
 * deleted_at を持つテーブルはソフトデリート、持たないテーブルは物理削除。
 */
export const deleteTableRow = async (table: string, id: string): Promise<ActionResult> => {
    const admin = await requireAdmin();
    if (!isAllowedTable(table)) {
        return actionFailure('許可されていないテーブルです');
    }

    const config = ALLOWED_TABLES[table];
    if (!config.deletable) {
        return actionFailure('このテーブルの行は削除できません（ユーザープロフィールの物理削除は対象外）');
    }

    const supabase = await createClient();

    if ('cascadeChild' in config && config.cascadeChild) {
        /** テーブル名が union のため eq のカラム型が never に潰れる。filter は string を受けるのでこちらを使う */
        const { count, error: countError } = await supabase
            .from(config.cascadeChild.table)
            .select('*', { count: 'exact', head: true })
            .filter(config.cascadeChild.fkColumn, 'eq', id);
        if (countError) {
            return actionFailure('参照データの確認に失敗しました。時間をおいて再度お試しください');
        }
        if ((count ?? 0) > 0) {
            return actionFailure(
                `この行を参照するデータが ${count} 件あるため削除できません。先に参照側を削除してください`,
            );
        }
    }

    try {
        if (config.hasDeletedAt) {
            await softDeleteRow(supabase, table, id, admin.id);
        } else {
            // deleted_at を持たないテーブルは物理削除（参照ありは DB の FK で 23503 になり mapMutationError で説明）
            await hardDeleteRow(supabase, table, id, admin.id, 0);
        }
        revalidatePath(`/tables/${table}`);
        return actionSuccess();
    } catch (error) {
        return actionFailure(mapMutationError(error));
    }
};

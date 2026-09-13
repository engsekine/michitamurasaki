'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/features/admin-auth';
import { mapMutationError } from '@/shared/lib/resource/errors';
import { hardDeleteRow } from '@/shared/lib/resource/mutations';
import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

/**
 * お問い合わせを物理削除（FR-018）。
 * 他テーブルから参照されないため referencing 件数は 0 固定。
 * hardDeleteRow 内で監査ログ（hard_delete）が記録される（spec 015 FR-018）。
 */
export const deleteInquiry = async (id: string): Promise<ActionResult> => {
    const admin = await requireAdmin();
    const supabase = await createClient();

    try {
        await hardDeleteRow(supabase, 'inquiries', id, admin.id, 0);
        revalidatePath('/inquiries');
        return actionSuccess();
    } catch (error) {
        return actionFailure(mapMutationError(error));
    }
};

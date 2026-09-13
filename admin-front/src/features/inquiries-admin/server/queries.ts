import type { Database } from '@repo/supabase';

import { requireAdmin } from '@/features/admin-auth';
import { listResource } from '@/shared/lib/resource/queries';
import type { ListParams, ResourceListResult } from '@/shared/lib/resource/types';
import { createClient } from '@/shared/lib/supabase/server';

type InquiryRow = Database['public']['Tables']['inquiries']['Row'];

/** 一覧表示に使う項目 */
export type InquiryListRow = Pick<InquiryRow, 'id' | 'name' | 'email' | 'category' | 'created_at'>;

/** 詳細表示に使う項目（本文・送信元 IP を含む） */
export type InquiryDetailRow = Pick<
    InquiryRow,
    'id' | 'name' | 'email' | 'category' | 'body' | 'submitter_user_id' | 'submitter_ip' | 'created_at'
>;

export const INQUIRY_SEARCH_COLUMNS = ['name', 'email'] as const;
export const INQUIRY_SORTABLE_COLUMNS = ['created_at'] as const;

const LIST_COLUMNS = 'id, name, email, category, created_at';
const DETAIL_COLUMNS = 'id, name, email, category, body, submitter_user_id, submitter_ip, created_at';

/** お問い合わせ一覧（受付日時の新しい順が既定 / FR-011） */
export const listInquiries = async (
    params: Pick<ListParams, 'page' | 'perPage' | 'search' | 'sort'>,
): Promise<ResourceListResult<InquiryListRow>> => {
    await requireAdmin();
    const supabase = await createClient();

    return listResource<InquiryListRow>(supabase, 'inquiries', LIST_COLUMNS, {
        ...params,
        searchColumns: INQUIRY_SEARCH_COLUMNS,
        sortableColumns: INQUIRY_SORTABLE_COLUMNS,
        hasDeletedAt: false,
    });
};

/** お問い合わせ詳細。該当なしは null（FR-010） */
export const getInquiryDetail = async (id: string): Promise<InquiryDetailRow | null> => {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase.from('inquiries').select(DETAIL_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw error;

    return data ?? null;
};

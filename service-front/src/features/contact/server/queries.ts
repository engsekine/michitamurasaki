import { createClient } from '@/shared/lib/supabase/server';

import { buildContactDefaultValues } from '../lib/prefill';
import type { ContactFormValues } from '../schemas/contact.schema';

/**
 * お問い合わせフォームの初期値を返す（US3 / FR-013）。
 * ログイン中なら氏名（user_details）とメール（auth）を補完し、未ログインは空を返す。
 * 取得は Server 側で行う（Constitution II）。
 */
export const getContactDefaultValues = async (): Promise<ContactFormValues> => {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return buildContactDefaultValues(null, null);

    const { data: detail } = await supabase
        .from('user_details')
        .select('last_name, first_name')
        .eq('user_id', user.id)
        .maybeSingle();

    return buildContactDefaultValues(detail ?? null, user.email ?? null);
};

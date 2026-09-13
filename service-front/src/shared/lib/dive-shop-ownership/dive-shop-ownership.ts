import 'server-only';

import type { createClient } from '@/shared/lib/supabase/server';

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 紐付けるショップが本人所有か検証する（033 / FR-007〜009）。
 * RLS により他人のショップは SELECT できないため、取得できなければ不正 id とみなす。
 * DB 側の ensure_dive_shop_owned トリガーと合わせた二重ガード。
 * 未選択（null・空文字）は「紐付けなし」として常に許可する。
 *
 * plans / dives / application-sheet の Server Actions から共通利用する
 * （feature 間 import 禁止のため features/shops ではなく shared/lib に置く）。
 */
export const isOwnDiveShop = async (supabase: ServerSupabaseClient, diveShopId: string | null): Promise<boolean> => {
    if (!diveShopId) return true;

    const { data } = await supabase.from('dive_shops').select('id').eq('id', diveShopId).maybeSingle();
    return data !== null;
};

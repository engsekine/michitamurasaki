import 'server-only';

import { type BuddyRowInput, mapDiveBuddies } from '@/features/dives/lib/buddies/buddy-mapper';
import { DIVE_FULL_COLUMNS, DIVE_SITE_JOIN, type DiveRowWithSite, mapDive } from '@/features/dives/lib/dive-mapper';
import { diveLocationLabel } from '@/features/dives/lib/diveLabel';
import { fetchDiveListPage } from '@/features/dives/lib/list-query';
import type { Dive, DiveBuddy, DiveCursor, DiveListFilter, DiveListPage } from '@/features/dives/types';
import { createClient } from '@/shared/lib/supabase/server';

export interface ListDivesOptions {
    filter?: DiveListFilter;
    cursor?: DiveCursor;
    limit?: number;
}

/**
 * 自分の dives を日付降順で取得。
 * キーセットページネーション（(dive_date, id) の複合カーソル）対応。
 * Supabase エラー時は throw し、Next.js の error.tsx に委ねる。
 */
export const listDives = async (options: ListDivesOptions = {}): Promise<DiveListPage> => {
    const supabase = await createClient();
    return fetchDiveListPage(supabase, options);
};

/**
 * 自分の dives の中で最大の dive_number を取得する。
 * 一度も dive_number を入力していない / ログがない場合は null を返す。
 * 新規作成画面で「前回の番号 + 1」を初期値として提示するために使う。
 */
export const getLatestDiveNumber = async (): Promise<number | null> => {
    const supabase = await createClient();

    // 公開読み取り RLS で他人の公開ログを拾わないよう本人に限定する
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('dives')
        .select('dive_number')
        .eq('user_id', user.id)
        .not('dive_number', 'is', null)
        .order('dive_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`dive_number の取得に失敗しました: ${error.message}`);

    return data?.dive_number ?? null;
};

/**
 * dive を 1 件取得する。RLS により「本人のログ」または「公開ログ」を取得できる
 * （公開ログの詳細を /dives/[id] で他ユーザーが閲覧できるようにするため）。
 * 閲覧不可・存在しない場合は null。編集など所有者限定の操作は呼び出し側で userId を確認すること。
 */
export const getDive = async (id: string): Promise<Dive | null> => {
    const supabase = await createClient();

    // dive_shop の join は RLS により本人以外には null になる（他ユーザーの公開ログ閲覧でショップは漏れない / 033 FR-015）
    const { data, error } = await supabase.from('dives').select(DIVE_FULL_COLUMNS).eq('id', id).maybeSingle();

    if (error) throw new Error(`dive の取得に失敗しました: ${error.message}`);
    if (!data) return null;

    return mapDive(data as unknown as DiveRowWithSite);
};

/**
 * 指定ダイブの同行バディ一覧を取得する（spec 021 US1）。
 * 本人除去済み（removed_by_buddy=true）は除外。登録ユーザーの nickname は
 * user_details から 2 段引きで解決する（PostgREST の多段 embed を避け堅牢にする）。
 * RLS により、閲覧可能なダイブ（自分 or 公開）のバディのみ返る。
 */
export const getDiveBuddies = async (diveId: string): Promise<DiveBuddy[]> => {
    const supabase = await createClient();

    const { data: rows, error } = await supabase
        .from('dive_log_buddies')
        .select('id, buddy_user_id, buddy_name')
        .eq('dive_id', diveId)
        .eq('removed_by_buddy', false)
        .order('created_at', { ascending: true });

    if (error) throw new Error(`バディの取得に失敗しました: ${error.message}`);
    if (!rows || rows.length === 0) return [];

    // 登録ユーザーの nickname をまとめて解決する。
    // 他ユーザーの user_details は RLS で読めないため、nickname のみを返す
    // get_user_public_profiles（SECURITY DEFINER）経由で取得する。
    const userIds = [...new Set(rows.map((r) => r.buddy_user_id).filter((id): id is string => id !== null))];
    const nicknameById = new Map<string, string>();
    const handleById = new Map<string, string>();
    if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase.rpc('get_user_public_profiles', {
            p_ids: userIds,
        });
        if (profileError) throw new Error(`バディの表示名取得に失敗しました: ${profileError.message}`);
        for (const profile of profiles ?? []) {
            nicknameById.set(profile.user_id, profile.nickname);
            handleById.set(profile.user_id, profile.handle);
        }
    }

    const inputs: BuddyRowInput[] = rows.map((r) => ({
        id: r.id,
        buddyUserId: r.buddy_user_id,
        buddyName: r.buddy_name,
        nickname: r.buddy_user_id ? (nicknameById.get(r.buddy_user_id) ?? null) : null,
        handle: r.buddy_user_id ? (handleById.get(r.buddy_user_id) ?? null) : null,
    }));

    return mapDiveBuddies(inputs);
};

/** 他機能からの紐づけ選択用に最小限の項目だけ持つダイブの要約 */
export interface DiveOption {
    id: string;
    /** ダイブ日（YYYY-MM-DD） */
    diveDate: string;
    location: string;
}

/**
 * 自分の全 dives を選択肢用に日付降順で取得する（id / 日付 / ポイント名のみ）。
 * 資格の「取得ダイブ」セレクトなど、他機能がページ層で合成して使う想定
 */
export const listDiveOptions = async (): Promise<DiveOption[]> => {
    const supabase = await createClient();

    // 選択肢は本人のログのみ。公開読み取り RLS で他人の公開ログを拾わないよう user_id を絞る
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('dives')
        .select(`id, dive_date, location, ${DIVE_SITE_JOIN}`)
        .eq('user_id', user.id)
        .order('dive_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (error || !data) {
        throw new Error(`[listDiveOptions] supabase error: ${error?.message ?? 'no data'}`);
    }

    // サイト参照ログは location が null のため、表示名はマスタから解決する
    return (data as unknown as Array<{ id: string; dive_date: string } & DiveRowWithSite>).map((row) => ({
        id: row.id,
        diveDate: row.dive_date,
        location: diveLocationLabel({ location: row.location, diveSite: row.dive_site }),
    }));
};

import 'server-only';

import type { Database } from '@repo/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { attachLikeInfo, buildLikeInfo, type LikeRow } from '@/features/social/lib/likes';
import type {
    FollowListKind,
    FollowState,
    FollowUser,
    LikedDivesCursor,
    LikedDivesPage,
    PublicProfile,
    TimelineCursor,
    TimelineItem,
    TimelinePage,
} from '@/features/social/types';
import { isSafeKeysetCursor } from '@/shared/lib/keyset-cursor';
import { isUuid, normalizeHandle, profilePath } from '@/shared/lib/profile-path';
import { createClient } from '@/shared/lib/supabase/server';

type Client = SupabaseClient<Database>;

/** ダイブ公開一覧で取得する列（TimelineItem に対応） */
const PUBLIC_DIVE_COLUMNS = 'id, user_id, dive_date, location, max_depth_m, bottom_time_min';
const DEFAULT_PAGE_SIZE = 20;

/**
 * タイムラインで IN 句に載せるフォロー先の上限（spec 021 FR-021）。
 * フォロー数が多いユーザーでも PostgREST の URL 長制限に達しないよう、
 * 直近フォローした relationships を優先して絞る。超過分は console.warn で明示する。
 */
const MAX_TIMELINE_FOLLOWEES = 1000;

/** 公開プロフィール要約（表示名 nickname + リンク用 handle） */
interface ProfileSummary {
    nickname: string;
    handle: string;
}

/** user_id 配列 → プロフィール要約の Map を get_user_public_profiles（SECURITY DEFINER）で解決する */
const resolveProfiles = async (supabase: Client, userIds: string[]): Promise<Map<string, ProfileSummary>> => {
    const unique = [...new Set(userIds)];
    const map = new Map<string, ProfileSummary>();
    if (unique.length === 0) return map;
    const { data, error } = await supabase.rpc('get_user_public_profiles', { p_ids: unique });
    if (error) throw new Error(`表示名の取得に失敗しました: ${error.message}`);
    for (const profile of data ?? []) map.set(profile.user_id, { nickname: profile.nickname, handle: profile.handle });
    return map;
};

/** ユーザー ID → user_id の解決（RPC 呼び出しの実体。クライアントは呼び出し側から共有する） */
const resolveUserIdByHandleWith = async (supabase: Client, handle: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc('get_user_id_by_handle', { p_handle: handle });
    if (error) throw new Error(`ユーザー ID の解決に失敗しました: ${error.message}`);

    return data ?? null;
};

/**
 * ユーザー ID → user_id の解決（034 / FR-001）。
 * 小文字正規化して照合する SECURITY DEFINER RPC を呼ぶ（大文字 URL も同一ユーザーに解決 = FR-002）。
 * 該当なしは null（呼び出し側で notFound()）。
 */
export const resolveUserIdByHandle = async (handle: string): Promise<string | null> =>
    resolveUserIdByHandleWith(await createClient(), handle);

/** プロフィール URL の slug 解決結果（034）。ok = 表示 / redirect = ニックネーム URL へ転送 */
export type ProfileSlugResolution = { kind: 'ok'; userId: string } | { kind: 'redirect'; nicknamePath: string } | null;

/**
 * `/users/[slug]` の slug（uuid or ユーザー ID）を解決する（034 Rev.2 / FR-001・FR-005・FR-007）。
 * - uuid（36 文字・形式一致。ユーザー ID は最大 30 文字のため衝突しない）: handle を取得し、
 *   現在のユーザー ID の URL への redirect 指示を返す（内部 ID URL の転送）
 * - それ以外: 小文字正規化してユーザー ID として解決
 * 不正なエンコード・該当なしは null（呼び出し側で notFound()）。
 */
export const resolveProfileSlug = async (slug: string): Promise<ProfileSlugResolution> => {
    let decoded: string;
    try {
        decoded = decodeURIComponent(slug);
    } catch {
        return null;
    }

    const supabase = await createClient();

    if (isUuid(decoded)) {
        const profiles = await resolveProfiles(supabase, [decoded]);
        const profile = profiles.get(decoded);
        if (profile === undefined) return null;
        return { kind: 'redirect', nicknamePath: profilePath({ userId: decoded, handle: profile.handle }) };
    }

    const userId = await resolveUserIdByHandleWith(supabase, normalizeHandle(decoded));
    return userId ? { kind: 'ok', userId } : null;
};

/**
 * プロフィール系ページ（本体 / followers / following）共通の slug 解決 + プロフィール取得。
 * - 解決不可・ユーザー不在 → notFound()
 * - uuid → ニックネーム URL へ subPath を維持して転送（FR-004）
 * React の cache() でリクエスト内メモ化し、generateMetadata と page 本体の二重フェッチを防ぐ。
 */
export const requireProfileBySlug = cache(async (slug: string, subPath: '' | '/followers' | '/following' = '') => {
    const resolved = await resolveProfileSlug(slug);
    if (!resolved) notFound();
    // profilePath が生成する自アプリ内パスのみのため typedRoutes の静的検証対象外（cast が必要）
    if (resolved.kind === 'redirect') redirect(`${resolved.nicknamePath}${subPath}` as Route);

    const profile = await fetchPublicProfile(resolved.userId);
    if (!profile) notFound();
    return profile;
});

/**
 * 対象ユーザーへのフォロー状態と件数（spec 021 FR-016）。
 * isFollowing は閲覧者（auth.uid）→ 対象、件数は対象を起点に集計する。
 */
export const fetchFollowState = async (targetUserId: string): Promise<FollowState> => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const [followingState, followerCountRes, followingCountRes] = await Promise.all([
        user
            ? supabase
                  .from('user_follows')
                  .select('follower_id', { head: true, count: 'exact' })
                  .eq('follower_id', user.id)
                  .eq('followee_id', targetUserId)
            : Promise.resolve({ count: 0 }),
        supabase
            .from('user_follows')
            .select('followee_id', { head: true, count: 'exact' })
            .eq('followee_id', targetUserId),
        supabase
            .from('user_follows')
            .select('follower_id', { head: true, count: 'exact' })
            .eq('follower_id', targetUserId),
    ]);

    // 件数はフォロー UI の中核（SC-003）。DB エラー時に 0 を誤表示しないよう明示的に失敗させる。
    if ('error' in followingState && followingState.error) {
        throw new Error(`フォロー状態の取得に失敗しました: ${followingState.error.message}`);
    }
    if (followerCountRes.error) {
        throw new Error(`フォロワー数の取得に失敗しました: ${followerCountRes.error.message}`);
    }
    if (followingCountRes.error) {
        throw new Error(`フォロー数の取得に失敗しました: ${followingCountRes.error.message}`);
    }

    return {
        isFollowing: (followingState.count ?? 0) > 0,
        followerCount: followerCountRes.count ?? 0,
        followingCount: followingCountRes.count ?? 0,
    };
};

/**
 * フォロー一覧 / フォロワー一覧（spec 021 FR-016）。created_at 降順のキーセット。
 * 各行に閲覧者がフォロー中かを付与してリスト上のフォローボタンに使う。
 */
export const fetchFollowLists = async (
    userId: string,
    kind: FollowListKind,
    options: { limit?: number; cursor?: string | null } = {},
): Promise<{ items: FollowUser[]; nextCursor: string | null }> => {
    const supabase = await createClient();
    const { limit = DEFAULT_PAGE_SIZE, cursor } = options;
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // following 一覧: 自分が follower の行を引き、相手 = followee_id。
    // followers 一覧: 自分が followee の行を引き、相手 = follower_id。
    // kind ごとに select を分けて、動的キーの unsafe cast を避けつつ相手 id を型安全に取り出す。
    const buildQuery = () => {
        const base =
            kind === 'following'
                ? supabase.from('user_follows').select('followee_id, created_at').eq('follower_id', userId)
                : supabase.from('user_follows').select('follower_id, created_at').eq('followee_id', userId);
        const ordered = base.order('created_at', { ascending: false }).limit(limit + 1);
        return cursor ? ordered.lt('created_at', cursor) : ordered;
    };

    const { data: rows, error } = await buildQuery();
    if (error) throw new Error(`フォロー一覧の取得に失敗しました: ${error.message}`);

    // kind に応じて相手 id と created_at を { targetId, createdAt } に正規化する
    const normalized = (rows ?? []).map((row) => ({
        targetId: 'followee_id' in row ? row.followee_id : row.follower_id,
        createdAt: row.created_at,
    }));

    const hasNext = normalized.length > limit;
    const pageRows = hasNext ? normalized.slice(0, limit) : normalized;
    const targetIds = pageRows.map((row) => row.targetId);

    const [profiles, myFollowing] = await Promise.all([
        resolveProfiles(supabase, targetIds),
        // 閲覧者が targetIds の誰をフォロー中か（リストのフォローボタン用）
        user && targetIds.length > 0
            ? supabase
                  .from('user_follows')
                  .select('followee_id')
                  .eq('follower_id', user.id)
                  .in('followee_id', targetIds)
            : Promise.resolve({ data: [] as { followee_id: string }[] }),
    ]);
    const followingSet = new Set((myFollowing.data ?? []).map((row) => row.followee_id));

    const items: FollowUser[] = pageRows.map(({ targetId }) => ({
        userId: targetId,
        nickname: profiles.get(targetId)?.nickname ?? '（不明なユーザー）',
        handle: profiles.get(targetId)?.handle ?? '',
        isFollowing: followingSet.has(targetId),
    }));

    const lastCursor = hasNext ? (pageRows.at(-1)?.createdAt ?? null) : null;
    return { items, nextCursor: lastCursor };
};

/**
 * ユーザー検索（spec 021 / フォロー導線）。ユーザー ID（handle）部分一致で他ユーザーを探す。
 * 呼び出し元自身は DB 関数側で除外。各行に閲覧者のフォロー状態を付与する。
 * 空クエリは即空配列。
 */
export const searchUsers = async (query: string): Promise<FollowUser[]> => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc('search_users_by_handle', { p_query: trimmed });
    if (error) throw new Error(`ユーザー検索に失敗しました: ${error.message}`);

    const results = data ?? [];
    const ids = results.map((row) => row.user_id);

    // 閲覧者が検索結果の誰をフォロー中か（一覧のフォローボタン用）
    const myFollowing =
        user && ids.length > 0
            ? await supabase
                  .from('user_follows')
                  .select('followee_id')
                  .eq('follower_id', user.id)
                  .in('followee_id', ids)
            : { data: [] as { followee_id: string }[] };
    const followingSet = new Set((myFollowing.data ?? []).map((row) => row.followee_id));

    return results.map((row) => ({
        userId: row.user_id,
        nickname: row.nickname,
        handle: row.handle,
        isFollowing: followingSet.has(row.user_id),
    }));
};

/**
 * 公開プロフィール（spec 021 US3）。nickname を解決し、存在しなければ null（→ 404）。
 * フォロー状態・件数も併せて返す。
 */
export const fetchPublicProfile = async (userId: string): Promise<PublicProfile | null> => {
    const supabase = await createClient();
    const profiles = await resolveProfiles(supabase, [userId]);
    const profile = profiles.get(userId);
    if (!profile) return null;

    const followState = await fetchFollowState(userId);
    return { userId, nickname: profile.nickname, handle: profile.handle, followState };
};

/**
 * 表示対象の dive ID 群のいいね行をバッチ 1 クエリで引き、件数 + 閲覧者のいいね済みを集計する
 * （spec 027 R7。項目ごとの個別クエリ = N+1 を避ける）。
 * 件数は行を取得して数える（PostgREST の集約が無効な環境でも動く。初期規模ではページ 20 件分で十分軽い）
 */
const fetchLikeInfoForDives = async (
    supabase: Client,
    diveIds: string[],
    viewerId: string | null,
): Promise<Map<string, { likeCount: number; likedByMe: boolean }>> => {
    if (diveIds.length === 0) return new Map();
    const { data, error } = await supabase.from('dive_likes').select('dive_id, user_id').in('dive_id', diveIds);
    if (error) throw new Error(`いいね情報の取得に失敗しました: ${error.message}`);
    return buildLikeInfo((data ?? []) as LikeRow[], viewerId);
};

/**
 * 1 ログ分のいいね件数と閲覧者のいいね済み状態（spec 027 FR-004/005）。
 * ログ詳細で使う。自分のログでも件数表示のため呼ばれる（US1-AC5）。
 */
export const fetchDiveLikeState = async (diveId: string): Promise<{ likeCount: number; likedByMe: boolean }> => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const [countRes, mineRes] = await Promise.all([
        supabase.from('dive_likes').select('dive_id', { head: true, count: 'exact' }).eq('dive_id', diveId),
        user
            ? supabase
                  .from('dive_likes')
                  .select('dive_id', { head: true, count: 'exact' })
                  .eq('dive_id', diveId)
                  .eq('user_id', user.id)
            : Promise.resolve({ count: 0, error: null }),
    ]);

    // 件数はいいね UI の中核（SC-001）。DB エラー時に 0 を誤表示しないよう明示的に失敗させる
    if (countRes.error) throw new Error(`いいね数の取得に失敗しました: ${countRes.error.message}`);
    if (mineRes.error) throw new Error(`いいね状態の取得に失敗しました: ${mineRes.error.message}`);

    return { likeCount: countRes.count ?? 0, likedByMe: (mineRes.count ?? 0) > 0 };
};

/** dives 行（公開一覧用）→ TimelineItem に変換（owner nickname は別途解決） */
const mapTimelineRow = (
    row: {
        id: string;
        user_id: string;
        dive_date: string;
        location: string | null;
        max_depth_m: number;
        bottom_time_min: number;
    },
    profiles: Map<string, ProfileSummary>,
): TimelineItem => ({
    diveId: row.id,
    diveDate: row.dive_date,
    // location はサイト参照時 null。公開一覧/タイムラインではサイト名未結合のためフォールバック表示する
    location: row.location ?? '名称未設定',
    maxDepthM: Number(row.max_depth_m),
    bottomTimeMin: row.bottom_time_min,
    ownerId: row.user_id,
    ownerNickname: profiles.get(row.user_id)?.nickname ?? '（不明なユーザー）',
    ownerHandle: profiles.get(row.user_id)?.handle ?? '',
    // いいね情報は attachLikeInfo（lib/likes）で後付けする。ここでは未取得の既定値
    likeCount: 0,
    likedByMe: false,
});

/**
 * 特定ユーザーの公開ログ一覧（spec 021 FR-015）。is_public=true のみ、(dive_date, id) キーセット。
 * RLS（authenticated can read public dives）により非公開は取得不可。
 */
export const fetchUserPublicDives = async (
    userId: string,
    options: { limit?: number; cursor?: TimelineCursor | null } = {},
): Promise<TimelinePage> => {
    const supabase = await createClient();
    const { limit = DEFAULT_PAGE_SIZE, cursor } = options;

    let query = supabase
        .from('dives')
        .select(PUBLIC_DIVE_COLUMNS)
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('dive_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
    if (cursor) {
        // クライアント由来のカーソルはフィルタ文字列へ補間するため、形式が不正なら空ページで打ち切る
        if (!isSafeKeysetCursor({ ...cursor })) return { items: [], nextCursor: null };
        query = query.or(`dive_date.lt.${cursor.diveDate},and(dive_date.eq.${cursor.diveDate},id.lt.${cursor.id})`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`公開ログの取得に失敗しました: ${error.message}`);

    const hasNext = (rows?.length ?? 0) > limit;
    const pageRows = (hasNext ? rows?.slice(0, limit) : rows) ?? [];
    const profiles = await resolveProfiles(
        supabase,
        pageRows.map((row) => row.user_id),
    );
    const items = pageRows.map((row) => mapTimelineRow(row, profiles));
    const last = pageRows.at(-1);
    const nextCursor = hasNext && last ? { diveDate: last.dive_date, id: last.id } : null;

    return { items, nextCursor };
};

/**
 * 自分がいいねしたログの一覧（spec 027 US2 / FR-007〜009）。
 * dive_likes を起点に dives を inner join し、いいね日時の新しい順（created_at, dive_id キーセット）で取得する。
 * 非公開化・削除済みのログは dives の RLS により join で自動的に除外される（FR-009）。
 */
export const fetchLikedDives = async (
    options: { limit?: number; cursor?: LikedDivesCursor | null } = {},
): Promise<LikedDivesPage> => {
    const supabase = await createClient();
    const { limit = DEFAULT_PAGE_SIZE, cursor } = options;
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { items: [], nextCursor: null };

    let query = supabase
        .from('dive_likes')
        .select(`created_at, dive_id, dives!inner(${PUBLIC_DIVE_COLUMNS})`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .order('dive_id', { ascending: false })
        .limit(limit + 1);
    if (cursor) {
        // クライアント由来のカーソルはフィルタ文字列へ補間するため、形式が不正なら空ページで打ち切る
        if (!isSafeKeysetCursor({ ...cursor })) return { items: [], nextCursor: null };
        query = query.or(
            `created_at.lt.${cursor.likedAt},and(created_at.eq.${cursor.likedAt},dive_id.lt.${cursor.diveId})`,
        );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`いいねしたログの取得に失敗しました: ${error.message}`);

    const hasNext = (rows?.length ?? 0) > limit;
    const pageRows = (hasNext ? rows?.slice(0, limit) : rows) ?? [];
    const dives = pageRows.map((row) => row.dives);

    const [profiles, likeInfo] = await Promise.all([
        resolveProfiles(
            supabase,
            dives.map((dive) => dive.user_id),
        ),
        fetchLikeInfoForDives(
            supabase,
            dives.map((dive) => dive.id),
            user.id,
        ),
    ]);
    const items = attachLikeInfo(
        dives.map((dive) => mapTimelineRow(dive, profiles)),
        likeInfo,
    );
    const last = pageRows.at(-1);
    const nextCursor = hasNext && last ? { likedAt: last.created_at, diveId: last.dive_id } : null;

    return { items, nextCursor };
};

/**
 * TOP タイムライン（spec 021 FR-017〜021）。
 * フォロー中ユーザーの公開ログを新しい順（dive_date, id キーセット）で取得する。
 * 未ログイン・フォロー 0 件は空。非公開は RLS により取得不可（二重防御）。
 */
export const fetchTimeline = async (
    options: { limit?: number; cursor?: TimelineCursor | null } = {},
): Promise<TimelinePage> => {
    const supabase = await createClient();
    const { limit = DEFAULT_PAGE_SIZE, cursor } = options;
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { items: [], nextCursor: null };

    // フォロー中の followee_id 集合を引く（0 件なら即空）。
    // フォロー数が多い場合は IN 句肥大化を避けるため直近フォロー順に上限で絞る（FR-021）。
    const { data: follows, error: followError } = await supabase
        .from('user_follows')
        .select('followee_id')
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_TIMELINE_FOLLOWEES + 1);
    if (followError) throw new Error(`フォロー情報の取得に失敗しました: ${followError.message}`);
    const allFolloweeIds = (follows ?? []).map((row) => row.followee_id);
    if (allFolloweeIds.length === 0) return { items: [], nextCursor: null };
    if (allFolloweeIds.length > MAX_TIMELINE_FOLLOWEES) {
        console.warn(
            `[fetchTimeline] フォロー数が上限(${MAX_TIMELINE_FOLLOWEES})を超えたため、直近フォロー分のみタイムラインに含めます`,
        );
    }
    const followeeIds = allFolloweeIds.slice(0, MAX_TIMELINE_FOLLOWEES);

    let query = supabase
        .from('dives')
        .select(PUBLIC_DIVE_COLUMNS)
        .in('user_id', followeeIds)
        .eq('is_public', true)
        .order('dive_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
    if (cursor) {
        // クライアント由来のカーソルはフィルタ文字列へ補間するため、形式が不正なら空ページで打ち切る
        if (!isSafeKeysetCursor({ ...cursor })) return { items: [], nextCursor: null };
        query = query.or(`dive_date.lt.${cursor.diveDate},and(dive_date.eq.${cursor.diveDate},id.lt.${cursor.id})`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`タイムラインの取得に失敗しました: ${error.message}`);

    const hasNext = (rows?.length ?? 0) > limit;
    const pageRows = (hasNext ? rows?.slice(0, limit) : rows) ?? [];
    const [profiles, likeInfo] = await Promise.all([
        resolveProfiles(
            supabase,
            pageRows.map((row) => row.user_id),
        ),
        fetchLikeInfoForDives(
            supabase,
            pageRows.map((row) => row.id),
            user.id,
        ),
    ]);
    const items = attachLikeInfo(
        pageRows.map((row) => mapTimelineRow(row, profiles)),
        likeInfo,
    );
    const last = pageRows.at(-1);
    const nextCursor = hasNext && last ? { diveDate: last.dive_date, id: last.id } : null;

    return { items, nextCursor };
};

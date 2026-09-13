'use server';

import { revalidatePath } from 'next/cache';

import type { LikedDivesCursor, LikedDivesPage } from '@/features/social/types';
import { requireUser } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

import { fetchLikedDives } from './queries';

/** Postgres ユニーク制約違反のエラーコード（重複フォロー・重複いいね） */
const PG_UNIQUE_VIOLATION = '23505';

/** Postgres 権限エラー（RLS 違反）のエラーコード */
const PG_INSUFFICIENT_PRIVILEGE = '42501';

/** いいねの変化が表示に影響するパスをまとめて revalidate する（詳細・いいね一覧・タイムライン） */
const revalidateLikePaths = (diveId: string): void => {
    revalidatePath(`/dives/${diveId}`);
    revalidatePath('/likes');
    revalidatePath('/');
};

/**
 * 対象ユーザーをフォローする（spec 021 FR-012）。承認不要の一方向。
 * follower は常に auth.uid（クライアント値を信用しない）。重複は冪等成功に変換。
 */
export const followUser = async (followeeId: string): Promise<ActionResult<{ isFollowing: true }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;
    if (user.id === followeeId) return actionFailure('自分自身はフォローできません');

    const { error } = await supabase.from('user_follows').insert({ follower_id: user.id, followee_id: followeeId });

    // 既にフォロー中（PK 重複）は冪等成功として扱う
    if (error && error.code !== PG_UNIQUE_VIOLATION) {
        console.error('[followUser] supabase error:', error);
        return actionFailure('フォローに失敗しました。時間をおいて再度お試しください');
    }

    // 034: プロフィールはニックネーム URL と ID URL の両方で表示されうるため、動的ルート全体を再検証する
    revalidatePath('/users/[slug]', 'page');
    return actionSuccess({ isFollowing: true });
};

/** フォローを解除する（spec 021 FR-013）。未フォローでも冪等成功。 */
export const unfollowUser = async (followeeId: string): Promise<ActionResult<{ isFollowing: false }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followee_id', followeeId);

    if (error) {
        console.error('[unfollowUser] supabase error:', error);
        return actionFailure('フォロー解除に失敗しました。時間をおいて再度お試しください');
    }

    // 034: プロフィールはニックネーム URL と ID URL の両方で表示されうるため、動的ルート全体を再検証する
    revalidatePath('/users/[slug]', 'page');
    return actionSuccess({ isFollowing: false });
};

/**
 * 公開ログにいいねを付ける（spec 027 FR-001/003）。
 * user_id は常に auth.uid（クライアント値を信用しない）。いいね済み（PK 重複）は冪等成功。
 * 自分のログ・非公開・削除済みは RLS が拒否する（42501。三重防御の DB 層 / FR-006・FR-014）。
 * 作成者への通知は DB トリガー（notify_on_like）が生成する。
 */
export const likeDive = async (diveId: string): Promise<ActionResult<{ isLiked: true }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase.from('dive_likes').insert({ user_id: user.id, dive_id: diveId });

    if (error && error.code !== PG_UNIQUE_VIOLATION) {
        if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
            return actionFailure('このログにはいいねできません');
        }
        console.error('[likeDive] supabase error:', error);
        return actionFailure('いいねに失敗しました。時間をおいて再度お試しください');
    }

    revalidateLikePaths(diveId);
    return actionSuccess({ isLiked: true });
};

/** いいねを取り消す（spec 027 FR-002）。対象行が無くても冪等成功（連打・多端末競合）。通知は削除しない */
export const unlikeDive = async (diveId: string): Promise<ActionResult<{ isLiked: false }>> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase.from('dive_likes').delete().eq('user_id', user.id).eq('dive_id', diveId);

    if (error) {
        console.error('[unlikeDive] supabase error:', error);
        return actionFailure('いいねの取り消しに失敗しました。時間をおいて再度お試しください');
    }

    revalidateLikePaths(diveId);
    return actionSuccess({ isLiked: false });
};

/**
 * いいね一覧の追加ページ取得（spec 027 US2 / SC-005）。
 * クライアントの「さらに読み込む」から呼ばれる薄いラッパー（025 loadMoreNotifications と同型）。
 * 対象は常に auth.uid の本人分のみ（fetchLikedDives 側で担保）。
 */
export const loadMoreLikedDives = async (cursor: LikedDivesCursor): Promise<LikedDivesPage> => {
    return fetchLikedDives({ cursor });
};

/**
 * バディとしてタグ付けされた本人が、自分宛のタグを除去する（spec 021 FR-024a）。
 * removed_by_buddy=true へのソフト除去。RLS "buddy can opt out own tag" により
 * 自分宛（buddy_user_id = auth.uid()）のタグのみ更新でき、除去後は所有者も削除・再タグ付け不可（FR-024b）。
 */
export const removeBuddyTagOfSelf = async (buddyTagId: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { data, error } = await supabase
        .from('dive_log_buddies')
        .update({ removed_by_buddy: true })
        .eq('id', buddyTagId)
        .eq('buddy_user_id', user.id)
        .select('dive_id')
        .maybeSingle();

    if (error) {
        console.error('[removeBuddyTagOfSelf] supabase error:', error);
        return actionFailure('タグの除去に失敗しました。時間をおいて再度お試しください');
    }
    if (!data) return actionFailure('対象のタグが見つかりません');

    revalidatePath(`/dives/${data.dive_id}`);
    return actionSuccess();
};

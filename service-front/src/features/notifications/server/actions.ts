'use server';

import { revalidatePath } from 'next/cache';

import { NOTIFICATION_TYPES, type NotificationType } from '@/features/notifications/constants';
import {
    listNotifications,
    type NotificationCursor,
    type NotificationPage,
} from '@/features/notifications/server/queries';
import { requireUser } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';
import { type ActionResult, actionFailure, actionSuccess } from '@/shared/types/action-result';

/**
 * 通知を 1 件既読にする（FR-005 / Clarification Q1: タップで既読）。
 * 0 行更新（他人の id・既に既読・存在しない id）は冪等に成功扱いとし、
 * 通知の存在有無という情報も漏らさない。
 */
export const markNotificationRead = async (id: string): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('recipient_id', user.id)
        .is('read_at', null)
        .select('id');

    if (error) {
        console.error('[markNotificationRead] supabase error:', error);
        return actionFailure('通知の既読化に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePath('/notifications');
    return actionSuccess();
};

/** 自分の未読通知をすべて既読にする（FR-005） */
export const markAllNotificationsRead = async (): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .is('read_at', null)
        .select('id');

    if (error) {
        console.error('[markAllNotificationsRead] supabase error:', error);
        return actionFailure('通知の既読化に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePath('/notifications');
    return actionSuccess();
};

/**
 * 通知一覧の追加ページを取得する（「さらに読み込む」用 / FR-003）。
 * Client Component から keyset カーソルで次ページを引くための薄いラッパー。
 */
export const loadMoreNotifications = async (cursor: NotificationCursor): Promise<NotificationPage> => {
    return listNotifications({ cursor });
};

/**
 * 通知種別の受け取り設定を更新する（FR-011）。
 * 行なし = ON の設計だが、ON に戻した場合も行を残す（is_enabled = true。設定履歴として単純）。
 * OFF 期間中のイベントは ON に戻しても遡及しない（生成側が生成しないだけなので、何もしない = 仕様どおり）。
 */
export const setNotificationPreference = async (type: NotificationType, enabled: boolean): Promise<ActionResult> => {
    const supabase = await createClient();

    const { user, failure } = await requireUser(supabase);
    if (failure) return failure;

    /** クライアントの型に依存せず、サーバー側でも種別を検証する */
    if (!NOTIFICATION_TYPES.includes(type)) {
        return actionFailure('不正な通知種別です');
    }

    const { error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: user.id, type, is_enabled: enabled }, { onConflict: 'user_id,type' });

    if (error) {
        console.error('[setNotificationPreference] supabase error:', error);
        return actionFailure('通知設定の保存に失敗しました。時間をおいて再度お試しください');
    }

    revalidatePath('/settings/notifications');
    return actionSuccess();
};

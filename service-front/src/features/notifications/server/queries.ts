import 'server-only';

import {
    NOTIFICATION_RETENTION_DAYS,
    NOTIFICATIONS_PAGE_SIZE,
    type NotificationType,
} from '@/features/notifications/constants';
import { getOverhaulDueDate, isPlanDueToday } from '@/features/notifications/lib/reminderDue';
import { todayInJst } from '@/shared/lib/date';
import { isSafeKeysetCursor } from '@/shared/lib/keyset-cursor';
import { createClient } from '@/shared/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;

/** 通知一覧の 1 アイテム（表示に必要な最小情報） */
export interface NotificationItem {
    id: string;
    type: NotificationType;
    /** 発生元ユーザー ID（ソーシャル通知のみ。退会で null） */
    actorId: string | null;
    /** 発生元ユーザーの表示名。退会・解決不可は null（「退会したユーザー」表示に使う） */
    actorNickname: string | null;
    /** actor のユーザー ID（034。プロフィールリンク生成用。退会・未解決時は null） */
    actorHandle: string | null;
    /** 対象リソース ID（dive / plan / regulator） */
    resourceId: string | null;
    occurredAt: string;
    /** 既読日時。null = 未読 */
    readAt: string | null;
}

/** keyset ページングのカーソル（occurred_at + id で一意に順序付け） */
export interface NotificationCursor {
    occurredAt: string;
    id: string;
}

export interface NotificationPage {
    items: NotificationItem[];
    nextCursor: NotificationCursor | null;
}

/** user_id 配列 → { nickname, handle } の Map を get_user_public_profiles（SECURITY DEFINER）で解決する */
const resolveProfiles = async (
    supabase: Client,
    userIds: string[],
): Promise<Map<string, { nickname: string; handle: string }>> => {
    const unique = [...new Set(userIds)];
    const map = new Map<string, { nickname: string; handle: string }>();
    if (unique.length === 0) return map;
    const { data, error } = await supabase.rpc('get_user_public_profiles', { p_ids: unique });
    if (error) {
        // 表示名は補助情報のため、失敗しても一覧自体は返す（「退会したユーザー」表示に落ちる）
        console.error('[listNotifications] nickname 解決に失敗しました:', error);
        return map;
    }
    for (const profile of data ?? []) map.set(profile.user_id, { nickname: profile.nickname, handle: profile.handle });
    return map;
};

/**
 * 自分宛の通知一覧（新しい順・keyset ページング / FR-003）。
 * RLS に加えて recipient_id の明示条件で本人分に限定する（二重防御）。
 */
export const listNotifications = async (
    options: { cursor?: NotificationCursor | null } = {},
): Promise<NotificationPage> => {
    const supabase = await createClient();
    const { cursor } = options;

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { items: [], nextCursor: null };

    let query = supabase
        .from('notifications')
        .select('id, type, actor_id, resource_id, occurred_at, read_at')
        .eq('recipient_id', user.id)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(NOTIFICATIONS_PAGE_SIZE + 1);
    if (cursor) {
        // クライアント由来のカーソルはフィルタ文字列へ補間するため、形式が不正なら空ページで打ち切る
        if (!isSafeKeysetCursor({ ...cursor })) return { items: [], nextCursor: null };
        query = query.or(
            `occurred_at.lt.${cursor.occurredAt},and(occurred_at.eq.${cursor.occurredAt},id.lt.${cursor.id})`,
        );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`通知の取得に失敗しました: ${error.message}`);

    const hasNext = (rows?.length ?? 0) > NOTIFICATIONS_PAGE_SIZE;
    const pageRows = (hasNext ? rows?.slice(0, NOTIFICATIONS_PAGE_SIZE) : rows) ?? [];

    const profiles = await resolveProfiles(
        supabase,
        pageRows.map((row) => row.actor_id).filter((id): id is string => id !== null),
    );

    const items: NotificationItem[] = pageRows.map((row) => ({
        id: row.id,
        type: row.type as NotificationType,
        actorId: row.actor_id,
        actorNickname: row.actor_id ? (profiles.get(row.actor_id)?.nickname ?? null) : null,
        actorHandle: row.actor_id ? (profiles.get(row.actor_id)?.handle ?? null) : null,
        resourceId: row.resource_id,
        occurredAt: row.occurred_at,
        readAt: row.read_at,
    }));

    const last = pageRows.at(-1);
    const nextCursor = hasNext && last ? { occurredAt: last.occurred_at, id: last.id } : null;

    return { items, nextCursor };
};

/**
 * 未読通知の件数（ヘッダーバッジ用 / FR-004）。
 * 全認証ページで実行されるため、失敗してもページ描画を止めず 0 を返す。
 */
export const getUnreadNotificationCount = async (): Promise<number> => {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .is('read_at', null);

    if (error) {
        console.error('[getUnreadNotificationCount] supabase error:', error);
        return 0;
    }
    return count ?? 0;
};

/** 挿入候補のリマインド通知行 */
interface ReminderCandidate {
    recipient_id: string;
    type: 'plan_reminder' | 'overhaul_reminder';
    resource_id: string;
    dedup_key: string;
}

/**
 * リマインド通知の遅延生成 + 90 日清掃（FR-009 / FR-010 / FR-013）。
 * TOP・通知一覧の表示時に本人分のみ実行する。冪等（既存 dedup_key はスキップ +
 * unique 制約が最終保証）。失敗はログのみでページ描画を止めない。
 */
export const ensureTimedNotifications = async (): Promise<void> => {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = todayInJst();

    try {
        // OFF 設定の種別を先に引く（FR-011）
        const { data: prefs } = await supabase
            .from('notification_preferences')
            .select('type, is_enabled')
            .eq('user_id', user.id)
            .in('type', ['plan_reminder', 'overhaul_reminder']);
        const disabled = new Set((prefs ?? []).filter((p) => p.is_enabled === false).map((p) => p.type));

        const candidates: ReminderCandidate[] = [];

        if (!disabled.has('plan_reminder')) {
            const { data: plans } = await supabase
                .from('dive_plans')
                .select('id, planned_on, created_at')
                .eq('user_id', user.id)
                .eq('planned_on', today);
            for (const plan of plans ?? []) {
                if (isPlanDueToday({ plannedOn: plan.planned_on, createdAt: plan.created_at, today })) {
                    candidates.push({
                        recipient_id: user.id,
                        type: 'plan_reminder',
                        resource_id: plan.id,
                        dedup_key: plan.planned_on,
                    });
                }
            }
        }

        if (!disabled.has('overhaul_reminder')) {
            const { data: regulators } = await supabase
                .from('regulators')
                .select('id, last_overhauled_on, overhaul_interval_months, overhaul_interval_dives')
                .eq('user_id', user.id);
            for (const regulator of regulators ?? []) {
                const dueDate = getOverhaulDueDate({
                    lastOverhauledOn: regulator.last_overhauled_on,
                    intervalMonths: regulator.overhaul_interval_months,
                    intervalDives: regulator.overhaul_interval_dives,
                    today,
                });
                if (dueDate) {
                    candidates.push({
                        recipient_id: user.id,
                        type: 'overhaul_reminder',
                        resource_id: regulator.id,
                        dedup_key: dueDate,
                    });
                }
            }
        }

        if (candidates.length > 0) {
            // 既存の同一（種別 × 対象 × 期限日）を除外して「1 回だけ」を守る。
            // 並行アクセスのすり抜けは unique 制約（式インデックス）が最終保証する
            const { data: existing } = await supabase
                .from('notifications')
                .select('type, resource_id, dedup_key')
                .eq('recipient_id', user.id)
                .in('type', ['plan_reminder', 'overhaul_reminder']);
            const seen = new Set((existing ?? []).map((n) => `${n.type}:${n.resource_id}:${n.dedup_key}`));
            const toInsert = candidates.filter((c) => !seen.has(`${c.type}:${c.resource_id}:${c.dedup_key}`));

            if (toInsert.length > 0) {
                const { error } = await supabase.from('notifications').insert(toInsert);
                // 23505（並行生成による重複）は冪等性の想定内
                if (error && error.code !== '23505') {
                    console.error('[ensureTimedNotifications] insert error:', error);
                }
            }
        }

        // 90 日超の通知を遅延削除（FR-013）
        const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('notifications').delete().eq('recipient_id', user.id).lt('occurred_at', cutoff);
    } catch (error) {
        console.error('[ensureTimedNotifications] unexpected error:', error);
    }
};

/** 通知設定の現在値（行なし = ON）。設定画面の初期表示用 */
export const listNotificationPreferences = async (): Promise<Record<string, boolean>> => {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
        .from('notification_preferences')
        .select('type, is_enabled')
        .eq('user_id', user.id);

    if (error) {
        console.error('[listNotificationPreferences] supabase error:', error);
        return {};
    }

    return Object.fromEntries((data ?? []).map((row) => [row.type, row.is_enabled]));
};

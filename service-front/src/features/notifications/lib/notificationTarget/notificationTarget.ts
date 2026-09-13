import type { NotificationItem } from '@/features/notifications/server/queries';
import { profilePath } from '@/shared/lib/profile-path';

/** 通知タップ時の遷移先。href null = リンク無効（テキスト表示） */
export interface NotificationTarget {
    href: string | null;
}

/**
 * 通知種別ごとの遷移先を解決する（contracts/ui-and-routes.md の遷移先マップ）。
 * actor 退会・対象消滅で ID が null の場合はリンク無効（href: null）にする。
 * 遷移先の存在確認は行わず、削除済みリソースは各ページの 404 / 表示制御に委譲する。
 */
export const getNotificationTarget = (
    item: Pick<NotificationItem, 'type' | 'actorId' | 'actorHandle' | 'resourceId'>,
): NotificationTarget => {
    switch (item.type) {
        case 'followed':
            // 034: プロフィールはユーザー ID の URL（未取得時は内部 ID URL → ページ側転送で正規化）
            return { href: item.actorId ? profilePath({ userId: item.actorId, handle: item.actorHandle }) : null };
        case 'buddy_tagged':
            return { href: item.resourceId ? `/dives/${item.resourceId}` : null };
        case 'log_liked':
            return { href: item.resourceId ? `/dives/${item.resourceId}` : null };
        case 'plan_reminder':
            return { href: item.resourceId ? `/plans/${item.resourceId}` : null };
        case 'overhaul_reminder':
            return { href: '/settings/equipment' };
    }
};

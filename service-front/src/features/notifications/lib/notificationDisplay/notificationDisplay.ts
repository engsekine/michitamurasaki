// 通知の表示用ヘルパー。NotificationList（一覧ページ）と NotificationBellPanel（ヘッダーのパネル）で共用する。
import { DELETED_USER_LABEL, NOTIFICATION_MESSAGES } from '@/features/notifications/constants';
import type { NotificationItem } from '@/features/notifications/server/queries';
import { formatJstDate } from '@/shared/lib/date';

/** occurred_at（timestamptz）を JST の暦日に変換して YYYY/MM/DD 表示にする */
export const formatOccurredAtJst = (occurredAt: string): string =>
    formatJstDate(new Date(occurredAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }));

/** 通知メッセージを組み立てる（{nickname} は退会時 DELETED_USER_LABEL に落ちる） */
export const buildNotificationMessage = (item: NotificationItem): string =>
    NOTIFICATION_MESSAGES[item.type].replace('{nickname}', item.actorNickname ?? DELETED_USER_LABEL);

/** actor 退会（nickname 解決不可）のソーシャル通知か。リンク無効化の判定に使う（FR-012） */
export const isNotificationActorDeleted = (item: NotificationItem): boolean =>
    (item.type === 'followed' || item.type === 'buddy_tagged') && item.actorNickname === null;

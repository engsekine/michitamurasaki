/** 通知種別（notifications.type の CHECK と一致させる） */
export type NotificationType = 'followed' | 'buddy_tagged' | 'plan_reminder' | 'overhaul_reminder' | 'log_liked';

/** 全種別の一覧（設定画面・サーバー側検証で使用） */
export const NOTIFICATION_TYPES = [
    'followed',
    'buddy_tagged',
    'plan_reminder',
    'overhaul_reminder',
    'log_liked',
] as const;

/** 設定画面に表示する種別ラベル */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
    followed: 'フォローされたとき',
    buddy_tagged: 'ログのバディに追加されたとき',
    plan_reminder: 'ダイビング予定日のリマインド',
    overhaul_reminder: 'レギュレーター OH 期限のリマインド',
    log_liked: 'ログにいいねされたとき',
};

/**
 * 通知一覧に表示する文言テンプレート（contracts/ui-and-routes.md）。
 * {nickname} はソーシャル通知でのみ置換される。
 */
export const NOTIFICATION_MESSAGES: Record<NotificationType, string> = {
    followed: '{nickname} さんにフォローされました',
    buddy_tagged: '{nickname} さんのログにバディとして追加されました',
    plan_reminder: '今日はダイビング予定日です',
    overhaul_reminder: 'レギュレーターの OH 期限が到来しました',
    log_liked: '{nickname} さんがあなたのログにいいねしました',
};

/** actor が退会済み（nickname 解決不可）のときの表示名 */
export const DELETED_USER_LABEL = '退会したユーザー';

/** 通知一覧の 1 ページ件数（keyset ページング） */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/** 通知の保持日数。超過分は本人アクセス時に遅延削除する（FR-013） */
export const NOTIFICATION_RETENTION_DAYS = 90;

/** 未読バッジの表示上限。超えたら「9+」表示（FR-004） */
export const UNREAD_BADGE_MAX = 9;

import type { DiveBuddy } from '@/features/dives/types';

/**
 * dive_log_buddies の 1 行（クエリで nickname を解決済み）を表す入力。
 * クエリ層（queries.ts）で登録ユーザーの nickname を結合して渡す前提で、
 * マッパーは純粋関数として表示モデルへの変換のみを担う（spec 021 US1）。
 */
export interface BuddyRowInput {
    id: string;
    buddyUserId: string | null;
    buddyName: string | null;
    /** 登録ユーザーの場合に解決済みの nickname（未解決・退会時は null） */
    nickname: string | null;
    /** 登録ユーザーの場合に解決済みのユーザー ID（034。未解決・退会時は null） */
    handle: string | null;
}

/** 登録ユーザー由来だが nickname を解決できなかった場合の表示名 */
const UNKNOWN_REGISTERED_NAME = '（不明なユーザー）';

/**
 * dive_log_buddies の行を表示モデル `DiveBuddy` に変換する。
 * - buddyUserId あり → 登録ユーザー（プロフィール遷移可・表示名は nickname）
 * - buddyUserId なし → フリーテキスト（buddy_name をそのまま表示）
 */
export const mapDiveBuddy = (row: BuddyRowInput): DiveBuddy => {
    const isRegistered = row.buddyUserId !== null;
    if (isRegistered) {
        return {
            id: row.id,
            userId: row.buddyUserId,
            name: row.nickname ?? UNKNOWN_REGISTERED_NAME,
            handle: row.handle,
            isRegistered: true,
        };
    }
    return {
        id: row.id,
        userId: null,
        handle: null,
        name: row.buddyName ?? '',
        isRegistered: false,
    };
};

/** 複数行をまとめて変換する */
export const mapDiveBuddies = (rows: BuddyRowInput[]): DiveBuddy[] => rows.map(mapDiveBuddy);

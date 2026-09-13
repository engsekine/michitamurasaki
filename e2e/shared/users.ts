/**
 * E2E で使うローカル開発専用ユーザー（supabase/seed.sql.template が投入する）。
 * E2E はアプリのソースを import しない独立ワークスペースのため、ここで一元管理する。
 * 値を変えるときは seed（`TEST_USER_*` は supabase/.env.local、管理者はテンプレート直書き）と揃える。
 */
export interface TestUser {
    email: string;
    password: string;
}

/** service-front の標準テストユーザー（handle: taro）。setup project がこのユーザーでログインする */
export const SERVICE_USER: TestUser = { email: 'test@example.com', password: 'password123' };

/** 別セッション側の登録ユーザー（handle: buddy-taro）。公開ビューの検証やフォロー相手として使う */
export const SERVICE_BUDDY_USER: TestUser = { email: 'buddy@example.com', password: 'password123' };

/** デイリーボーナス検証専用（seed で当日分の daily_bonus を付与していない） */
export const SERVICE_BONUS_USER: TestUser = { email: 'bonus@example.com', password: 'password123' };

/** ユーザー ID（handle）変更フロー専用（他テストのプロフィール URL 前提を壊さないよう分離） */
export const SERVICE_RENAME_USER: TestUser = { email: 'rename@example.com', password: 'password123' };

/** admin-front の上位管理者（superadmin）。setup project がこのユーザーでログインする */
export const ADMIN_USER: TestUser = { email: 'admin@example.com', password: 'admin-password' };

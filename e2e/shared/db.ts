import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * ローカル Supabase の DB 状態を直接操作するヘルパー。
 *
 * なぜ: 「1 日 1 回」のような冪等な仕組みは、同日中に E2E を 2 回目以降実行すると
 * 初回しか検証できない（毎回 `make supabase-reset` を挟む運用はローカルでも CI でも守られない）。
 * テスト自身が前提となる DB 状態を作り直すことで、何度実行しても同じ結果になるようにする。
 * どうやるか: Supabase CLI が起動する Postgres コンテナ（`supabase_db_<project_id>`）に
 * `docker exec ... psql` で SQL を流す。psql はコンテナ内のものを使うためホストへの追加インストールは不要。
 * RLS や RPC の execute 権限を迂回するため、テストの準備以外の目的で使わないこと。
 */

const execFileAsync = promisify(execFile);

/** `supabase/config.toml` の project_id。変更時は揃える */
const SUPABASE_PROJECT_ID = 'claude-settings';
const DB_CONTAINER = `supabase_db_${SUPABASE_PROJECT_ID}`;

/** ローカル Supabase の Postgres で SQL を 1 文実行する（失敗時は psql のエラーを投げる） */
const runSql = async (sql: string): Promise<void> => {
    await execFileAsync('docker', [
        'exec',
        DB_CONTAINER,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        sql,
    ]);
};

/**
 * 指定ユーザーの当日（JST）分デイリーボーナスを取り消し、未付与の状態に戻す。
 * ledger の追記専用の原則（026 FR-016）を破るのは E2E の前提作りに限る。
 * 残高キャッシュ（log_credit_balances）は ledger の合計と一致させる必要があるため、
 * 削除した amount 分を同一文で減算する。
 */
export const revokeTodaysDailyBonus = async (userId: string): Promise<void> => {
    await runSql(`
        with revoked as (
            delete from public.log_credit_ledger
            where user_id = '${userId}'
              and kind = 'daily_bonus'
              and granted_on = (now() at time zone 'Asia/Tokyo')::date
            returning amount
        )
        update public.log_credit_balances
        set balance = balance - coalesce((select sum(amount) from revoked), 0),
            updated_at = now()
        where user_id = '${userId}';
    `);
};

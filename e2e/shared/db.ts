import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * ローカル Supabase の DB 状態を直接操作するヘルパー。
 *
 * なぜ: 「1 日 1 回」「ログ 1 件で枠 1 消費」のような仕組みは、同日中に E2E を繰り返すと
 * 初回しか成立しない（毎回 `make supabase-reset` を挟む運用はローカルでも CI でも守られない）。
 * テスト自身が前提となる DB 状態を作り直すことで、何度実行しても同じ結果になるようにする。
 * どうやるか: Supabase CLI が起動する Postgres コンテナ（`supabase_db_<project_id>`）に
 * `docker exec ... psql` で SQL を流す。psql はコンテナ内のものを使うためホストへの追加インストールは不要。
 * ユーザーはメールアドレスで特定する（seed のユーザー id は環境変数で差し替わるため固定値を持たない）。
 * RLS や RPC の execute 権限を迂回するため、テストの準備以外の目的で使わないこと。
 */

const execFileAsync = promisify(execFile);

/** `supabase/config.toml` の project_id。変更時は揃える */
const SUPABASE_PROJECT_ID = 'claude-settings';
const DB_CONTAINER = `supabase_db_${SUPABASE_PROJECT_ID}`;

/** ローカル Supabase の Postgres で SQL を実行する（失敗時は psql のエラーを投げる） */
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

/** SQL 文字列リテラル用にシングルクォートをエスケープする（値は固定のテストデータだが念のため） */
const sqlLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** メールアドレスから auth.users の id を引くサブクエリ */
const userIdByEmail = (email: string): string => `(select id from auth.users where email = ${sqlLiteral(email)})`;

/**
 * 指定ユーザーの当日（JST）分デイリーボーナスを取り消し、未付与の状態に戻す。
 * ledger の追記専用の原則（026 FR-016）を破るのは E2E の前提作りに限る。
 * 残高キャッシュ（log_credit_balances）は ledger の合計と一致させる必要があるため、
 * 削除した amount 分を同一文で減算する。
 */
export const revokeTodaysDailyBonus = async (email: string): Promise<void> => {
    await runSql(`
        with revoked as (
            delete from public.log_credit_ledger
            where user_id = ${userIdByEmail(email)}
              and kind = 'daily_bonus'
              and granted_on = (now() at time zone 'Asia/Tokyo')::date
            returning amount
        )
        update public.log_credit_balances
        set balance = balance - coalesce((select sum(amount) from revoked), 0),
            updated_at = now()
        where user_id = ${userIdByEmail(email)};
    `);
};

/**
 * 指定ユーザーのログ枠残高が minBalance 以上になるよう不足分を付与する。
 *
 * なぜ: ログ作成は 1 件につき 1 枠を消費し、削除しても枠は戻らない（026）。
 * seed の枠は 30 のため、ログを作る E2E を同日中に繰り返すと枠切れで作成できなくなり、
 * テストと無関係な「ログ枠がありません」で落ちる。setup project で毎回ここを通し、枠切れを起こさない。
 * どうやるか: 正規の書き込み口 apply_credit_ledger_entry を initial_grant として呼び、残高キャッシュとの整合を関数側に任せる。
 */
export const ensureLogCredits = async (email: string, minBalance: number): Promise<void> => {
    await runSql(`
        select public.apply_credit_ledger_entry(
            ${userIdByEmail(email)},
            'initial_grant',
            ${minBalance} - coalesce((select balance from public.log_credit_balances where user_id = ${userIdByEmail(email)}), 0)
        )
        where coalesce((select balance from public.log_credit_balances where user_id = ${userIdByEmail(email)}), 0) < ${minBalance};
    `);
};

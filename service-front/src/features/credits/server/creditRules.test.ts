/**
 * ログ枠ルールの DB 統合テスト（026 / T008）。
 *
 * マイグレーション（create_log_credits / alter_handle_new_user）が適用された
 * ローカル Supabase に対して、トリガー・RPC・RLS の振る舞いを実 DB で検証する。
 *
 * 実行方法（quickstart.md 参照）:
 *   supabase db reset
 *   SUPABASE_DB_TESTS=1 npx vitest run --project=unit src/features/credits/server/creditRules.test.ts
 *
 * ローカル以外（CI 等）ではデフォルトでスキップされる。
 */
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const SUPABASE_URL = process.env['SUPABASE_TEST_URL'] ?? 'http://127.0.0.1:54321';
/** supabase start が発行するローカル開発専用の公開デモキー（本番キーではない） */
const ANON_KEY =
    process.env['SUPABASE_TEST_ANON_KEY'] ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY =
    process.env['SUPABASE_TEST_SERVICE_ROLE_KEY'] ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const admin = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** 新規テストユーザーを作成し、確認済みメール + パスワードでサインイン済みクライアントを返す */
const createTestUser = async (): Promise<{ userId: string; asUser: SupabaseClient }> => {
    const email = `credit-test-${crypto.randomUUID()}@example.com`;
    const password = 'credit-test-password-1';
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`テストユーザー作成に失敗: ${error?.message}`);

    const asUser = createSupabaseClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: signInError } = await asUser.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`サインインに失敗: ${signInError.message}`);
    return { userId: data.user.id, asUser };
};

const getBalance = async (userId: string): Promise<number> => {
    const { data, error } = await admin.from('log_credit_balances').select('balance').eq('user_id', userId).single();
    if (error) throw new Error(`残高取得に失敗: ${error.message}`);
    return data.balance;
};

const getLedgerSum = async (userId: string): Promise<number> => {
    const { data, error } = await admin.from('log_credit_ledger').select('amount').eq('user_id', userId);
    if (error) throw new Error(`ledger 取得に失敗: ${error.message}`);
    return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
};

/** dives への最小 insert（service_role。トリガーは role に関係なく発火する） */
const insertDive = (userId: string, diveDate = '2026-06-01') =>
    admin
        .from('dives')
        .insert({
            user_id: userId,
            dive_date: diveDate,
            location: 'テスト / 大瀬崎',
            max_depth_m: 18,
            bottom_time_min: 40,
        })
        .select('id')
        .single();

/** 残高を任意値へ調整する（テスト準備用。ledger も揃えて整合を保つ） */
const setBalance = async (userId: string, target: number): Promise<void> => {
    const current = await getBalance(userId);
    const diff = target - current;
    if (diff === 0) return;
    // テスト準備用の調整は返金調整として積む（amount <> 0 制約のため diff=0 は除外済み）
    const purchaseId = crypto.randomUUID();
    const { error: purchaseError } = await admin.from('log_credit_purchases').insert({
        id: purchaseId,
        user_id: userId,
        quantity: Math.abs(diff),
        amount_jpy: 0,
        status: 'completed',
        stripe_checkout_session_id: `cs_test_setup_${purchaseId}`,
        credited_at: new Date().toISOString(),
    });
    if (purchaseError) throw new Error(`準備用 purchase 作成に失敗: ${purchaseError.message}`);

    const { error: ledgerError } = await admin.from('log_credit_ledger').insert({
        user_id: userId,
        kind: diff > 0 ? 'purchase' : 'refund_adjustment',
        amount: diff,
        purchase_id: purchaseId,
    });
    if (ledgerError) throw new Error(`準備用 ledger 追記に失敗: ${ledgerError.message}`);

    const { error: balanceError } = await admin
        .from('log_credit_balances')
        .update({ balance: target })
        .eq('user_id', userId);
    if (balanceError) throw new Error(`準備用残高更新に失敗: ${balanceError.message}`);

    const applied = await getBalance(userId);
    if (applied !== target) throw new Error(`残高が更新されていない: expected=${target} actual=${applied}`);
};

describe.runIf(process.env['SUPABASE_DB_TESTS'] === '1')('ログ枠ルール（DB 統合）', () => {
    it('新規ユーザーには初期枠 10 が付与される（FR-008）', async () => {
        const { userId } = await createTestUser();
        expect(await getBalance(userId)).toBe(10);

        const { data: ledger } = await admin.from('log_credit_ledger').select('kind, amount').eq('user_id', userId);
        expect(ledger).toEqual([{ kind: 'initial_grant', amount: 10 }]);
    });

    it('dives の insert で残高が 1 減り、consumption が dive_id 付きで記録される（FR-001）', async () => {
        const { userId } = await createTestUser();

        const { data: dive, error } = await insertDive(userId);
        expect(error).toBeNull();
        expect(await getBalance(userId)).toBe(9);

        const { data: consumption } = await admin
            .from('log_credit_ledger')
            .select('amount, dive_id')
            .eq('user_id', userId)
            .eq('kind', 'consumption')
            .single();
        expect(consumption).toEqual({ amount: -1, dive_id: dive?.id });
    });

    it("残高 0 では insert が detail = 'no_credit' で失敗し、ログも作られない（FR-002）", async () => {
        const { userId } = await createTestUser();
        await setBalance(userId, 0);

        const { error } = await insertDive(userId);
        expect(error?.code).toBe('P0001');
        expect(error?.details).toBe('no_credit');

        const { count } = await admin.from('dives').select('id', { count: 'exact', head: true }).eq('user_id', userId);
        expect(count).toBe(0);
        expect(await getBalance(userId)).toBe(0);
    });

    it('残高 1 への並行 insert 2 件は 1 件だけ成功する（Edge Case: 同時多重リクエスト）', async () => {
        const { userId } = await createTestUser();
        await setBalance(userId, 1);

        const [first, second] = await Promise.all([insertDive(userId, '2026-06-01'), insertDive(userId, '2026-06-02')]);
        const successCount = [first, second].filter((result) => result.error === null).length;
        const noCreditCount = [first, second].filter((result) => result.error?.details === 'no_credit').length;

        expect(successCount).toBe(1);
        expect(noCreditCount).toBe(1);
        expect(await getBalance(userId)).toBe(0);
    });

    it('grant_daily_bonus は同日 2 回呼んでも +1 のみ（FR-003 冪等）', async () => {
        const { userId, asUser } = await createTestUser();

        const { error: firstError } = await asUser.rpc('grant_daily_bonus');
        expect(firstError).toBeNull();
        expect(await getBalance(userId)).toBe(11);

        const { error: secondError } = await asUser.rpc('grant_daily_bonus');
        expect(secondError).toBeNull();
        expect(await getBalance(userId)).toBe(11);
    });

    it('grant_daily_bonus は付与発生の有無を返す（036 FR-001: 初回 true / 同日 2 回目 false）', async () => {
        const { asUser } = await createTestUser();

        const first = await asUser.rpc('grant_daily_bonus');
        expect(first.error).toBeNull();
        expect(first.data).toBe(true);

        // 同日 2 回目は付与済みのため false（付与量が増えないことは既存の冪等テストで担保）
        const second = await asUser.rpc('grant_daily_bonus');
        expect(second.error).toBeNull();
        expect(second.data).toBe(false);
    });

    it('前日分のボーナスがあれば新しい日の分は付与される（FR-003）', async () => {
        const { userId, asUser } = await createTestUser();
        await asUser.rpc('grant_daily_bonus');

        // granted_on を前日へ書き換えて「日付が変わった」状態を再現する
        await admin
            .from('log_credit_ledger')
            .update({ granted_on: '2026-01-01' })
            .eq('user_id', userId)
            .eq('kind', 'daily_bonus');

        await asUser.rpc('grant_daily_bonus');
        expect(await getBalance(userId)).toBe(12);
    });

    it('authenticated から apply_credit_ledger_entry を直接呼べない（analyze C1 / 原則 IV）', async () => {
        const { userId, asUser } = await createTestUser();

        const { error } = await asUser.rpc('apply_credit_ledger_entry', {
            p_user_id: userId,
            p_kind: 'purchase',
            p_amount: 100,
        });
        expect(error).not.toBeNull();
        expect(await getBalance(userId)).toBe(10);
    });

    it('authenticated は自分の ledger / balances を読めるが書き込めない（RLS）', async () => {
        const { userId, asUser } = await createTestUser();

        const { data: balanceRows } = await asUser.from('log_credit_balances').select('balance');
        expect(balanceRows).toEqual([{ balance: 10 }]);

        const { error: insertError } = await asUser
            .from('log_credit_ledger')
            .insert({ user_id: userId, kind: 'purchase', amount: 100, purchase_id: crypto.randomUUID() });
        expect(insertError).not.toBeNull();

        const { data: updated } = await asUser
            .from('log_credit_balances')
            .update({ balance: 9999 })
            .eq('user_id', userId)
            .select('balance');
        // RLS の update ポリシーが無いため 0 行更新（エラーではなく空）になる
        expect(updated).toEqual([]);
        expect(await getBalance(userId)).toBe(10);
    });

    it('ledger の合計と balance が常に一致する（FR-016 / SC-004）', async () => {
        const { userId, asUser } = await createTestUser();
        await asUser.rpc('grant_daily_bonus');
        await insertDive(userId, '2026-06-01');
        await insertDive(userId, '2026-06-02');

        expect(await getBalance(userId)).toBe(await getLedgerSum(userId));
    });

    it('ログの削除で枠は返却されない（FR-011）', async () => {
        const { userId } = await createTestUser();
        const { data: dive } = await insertDive(userId);
        expect(await getBalance(userId)).toBe(9);

        await admin
            .from('dives')
            .delete()
            .eq('id', dive?.id ?? '');
        expect(await getBalance(userId)).toBe(9);
    });
});

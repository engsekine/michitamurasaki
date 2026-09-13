import type { User } from '@supabase/supabase-js';

/**
 * Supabase の認証保証レベル（AAL）判定。
 * 「1 段階目は済んだが 2 段階目（MFA）が未完了」の状態を、改ざん不能な情報だけから判定する。
 *
 * なぜ `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` を使わないか:
 * 引数なしで呼ぶと auth-js は `getSession()`（サーバーでは cookie）から `session.user.factors`
 * を読んで nextLevel を決める。cookie 内の `user` は JWT の署名対象外の平文 JSON なので、
 * 攻撃者が `factors: []` に書き換えるだけで「MFA 未登録」に偽装でき、2 段階目を素通りできた。
 *
 * どうやるか:
 * - factors は Auth サーバーが返す `getUser()` の結果（検証済み）から読む
 * - 現在の AAL は署名検証済みのクレーム（`getClaims()`）から読む
 * - どちらかが取れないときは「不明」として扱い、呼び出し側が fail-closed に判定できるようにする
 */
export interface AalLevels {
    /** 署名検証済み JWT の aal クレーム。取得できなければ null（不明） */
    currentLevel: string | null;
    /** 検証済み factors から導出した到達すべきレベル（verified な要素があれば aal2） */
    nextLevel: string | null;
}

/** getVerifiedAalLevels が必要とする最小のクライアント形（テスト・型結合を最小化） */
export interface AalAuthClient {
    auth: {
        getUser(jwt?: string): Promise<{ data: { user: User | null }; error: unknown }>;
        getClaims(jwt?: string): Promise<{ data: { claims: { aal?: unknown } } | null; error: unknown }>;
    };
}

export interface VerifiedAalOptions {
    /** 既に `getUser()` で検証済みの user があれば渡す（再取得を省く） */
    user?: User | undefined;
    /** cookie セッションではなく Bearer トークンで認証している場合に渡す（モバイル等） */
    jwt?: string | undefined;
}

/**
 * 2 段階目の確認が保留中（保護ルートを遮断すべき状態）なら true。
 * - MFA を有効化しているユーザー（nextLevel='aal2'）が aal2 に到達していなければ保留中
 * - 現在レベルが「不明」（null）でも MFA 有効なら保留中扱いにする（fail-closed）
 * - 未有効化ユーザーは nextLevel が 'aal2' にならないため常に false（体験は不変）
 */
export const isMfaChallengePending = (levels: AalLevels | null): boolean => {
    if (!levels) return false;
    return levels.nextLevel === 'aal2' && levels.currentLevel !== 'aal2';
};

/**
 * 改ざん不能な情報から AAL を判定する。
 * 未認証（getUser 失敗）なら null を返す。
 */
export const getVerifiedAalLevels = async (
    supabase: AalAuthClient,
    options: VerifiedAalOptions = {},
): Promise<AalLevels | null> => {
    let user = options.user ?? null;
    if (!user) {
        const { data, error } = await supabase.auth.getUser(options.jwt);
        if (error || !data.user) return null;
        user = data.user;
    }

    const hasVerifiedFactor = (user.factors ?? []).some((factor) => factor.status === 'verified');
    // verified な要素が無ければ 2 段階目は存在しない（aal2 に昇格する経路が無い）ので
    // クレームを取りに行かずに確定させる（ネットワーク往復と障害点を増やさない）
    if (!hasVerifiedFactor) return { currentLevel: 'aal1', nextLevel: 'aal1' };

    const { data, error } = await supabase.auth.getClaims(options.jwt);
    const aal = data?.claims.aal;
    const currentLevel = !error && typeof aal === 'string' ? aal : null;
    return { currentLevel, nextLevel: 'aal2' };
};

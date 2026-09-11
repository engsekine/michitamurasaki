/**
 * Supabase の認証保証レベル（AAL）判定（023 / US2 / FR-010・FR-015）。
 *
 * 実装は `@repo/supabase/aal` に集約している（admin-front と共用）。
 * 以前は `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` の戻りをそのまま判定していたが、
 * この API は cookie 内の改ざん可能な `user.factors` を根拠にしていたため、
 * 検証済みの `getUser()` / `getClaims()` から判定する実装へ置き換えた。
 */
export {
    type AalAuthClient,
    type AalLevels,
    getVerifiedAalLevels,
    isMfaChallengePending,
    type VerifiedAalOptions,
} from '@repo/supabase/aal';

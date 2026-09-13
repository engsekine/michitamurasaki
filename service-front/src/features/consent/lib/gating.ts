import { getCookieConsentClient } from './cookie-consent';

/**
 * 非必須 Cookie / スクリプトを「同意済み」のときだけ実行するガード（017-cookie-consent）。
 *
 * 現状この製品に非必須 Cookie は存在しないが、将来アクセス解析等を追加する場合は
 * **必ずこの関数を経由**して読み込むこと。同意状態の参照を一箇所に集約することで、
 * 拒否/未選択のユーザーに非必須 Cookie を保存・利用しない（FR-006/FR-007）保証を一貫させる。
 *
 * @example
 *   // 将来のアナリティクス導入例:
 *   runWhenConsented(() => loadAnalytics());
 *
 * @returns 同意済みでローダを実行できたら true、拒否/未選択・ローダ失敗なら false
 */
export const runWhenConsented = (loader: () => void): boolean => {
    if (getCookieConsentClient() !== 'accepted') {
        return false;
    }
    try {
        loader();
        return true;
    } catch (error) {
        // 非必須ローダ（将来のアナリティクス等）の失敗をページ全体に伝播させない
        console.error('[consent] gating loader failed:', error);
        return false;
    }
};

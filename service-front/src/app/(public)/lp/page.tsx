import { DAILY_BONUS_AMOUNT, INITIAL_GRANT_AMOUNT, LOG_CREDIT_PACKS } from '@/features/credits';
import { LandingCta, LandingFeatures, LandingHero, LandingPricing, PAGE_DATA } from '@/features/landing';
import { generatePageMetadata } from '@/shared/config/metadata';

// noIndex は付けない（検索インデックスを許可 / 031 FR-009）
export const metadata = generatePageMetadata(PAGE_DATA);

/**
 * ランディングページ（031）。専用 URL `/lp` で認証の有無にかかわらず閲覧できる。
 * `proxy.ts` は `/lp` を認証必須にも認証済みリダイレクト対象にもしないため素通しされる。
 *
 * 全体を Server Components のみで構成し、クライアント JS に依存しない（FR-011 / JS 無効でも閲覧・遷移可）。
 * 料金の具体額（枠数・価格）は credits feature の定数を唯一の情報源とし、
 * feature 間 import 禁止のためここ（app 層）で読み取って LandingPricing に注入する。
 */
export default function LandingPage() {
    return (
        <div className="flex flex-1 flex-col">
            <LandingHero />
            <LandingFeatures />
            <LandingPricing
                packs={LOG_CREDIT_PACKS}
                initialGrantAmount={INITIAL_GRANT_AMOUNT}
                dailyBonusAmount={DAILY_BONUS_AMOUNT}
            />
            <LandingCta />
        </div>
    );
}

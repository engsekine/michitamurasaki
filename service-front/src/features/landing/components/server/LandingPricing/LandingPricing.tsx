import { cn } from '@/lib/utils';

/**
 * 料金セクション（031 / FR-005）。
 * 価格・枠数はハードコードせず props で受け取る。値の唯一の情報源は
 * features/credits の定数（LOG_CREDIT_PACKS）で、feature 間 import を避けるため
 * page.tsx（app 層）が注入する。
 */
interface LandingPricingPack {
    /** 付与されるログ枠数 */
    quantity: number;
    /** 税込価格（円） */
    amountJpy: number;
    /** パック名（例: お試しパック（10 枠）） */
    displayName: string;
    /** 割引率の表示（例: 約17%おトク）。基準パックは null */
    discountLabel: string | null;
    /** おすすめパックとして強調するか */
    isRecommended: boolean;
}

interface LandingPricingProps {
    /** ログパックの一覧（LOG_CREDIT_PACKS） */
    packs: readonly LandingPricingPack[];
    /** 新規登録時の初期無料枠（INITIAL_GRANT_AMOUNT） */
    initialGrantAmount: number;
    /** デイリーボーナスの 1 日あたり付与枠（DAILY_BONUS_AMOUNT） */
    dailyBonusAmount: number;
}

/** 円を「1,000 円」形式にする（3 桁区切り） */
const formatJpy = (amount: number): string => `${amount.toLocaleString('ja-JP')} 円`;

export const LandingPricing = ({ packs, initialGrantAmount, dailyBonusAmount }: LandingPricingProps) => {
    return (
        <section aria-labelledby="landing-pricing-title" className="mx-auto w-full max-w-5xl px-4 py-16">
            <h2
                id="landing-pricing-title"
                className="mb-4 text-center font-bold text-2xl text-foreground tracking-tight sm:text-3xl"
            >
                料金
            </h2>
            <p className="mb-12 text-center text-muted-foreground text-sm sm:text-base">
                基本無料で使えます。もっと記録したくなったら、必要な分だけ買い足せます。
            </p>
            <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-6">
                    <h3 className="font-semibold text-foreground text-lg">無料ではじめる</h3>
                    <p className="font-bold text-3xl text-foreground">0 円</p>
                    <ul className="flex flex-col gap-2 text-muted-foreground text-sm">
                        <li>登録時にログ枠 {initialGrantAmount} 枠をプレゼント</li>
                        <li>毎日ログインで +{dailyBonusAmount} 枠</li>
                        <li>記録・統計・予定・タイムラインのすべての機能が使えます</li>
                    </ul>
                </div>
                {packs.map((pack) => (
                    <div
                        key={pack.displayName}
                        className={cn(
                            'flex flex-col gap-3 rounded-xl border border-border bg-background p-6',
                            // おすすめカードのアクセントは border-primary で表す。bg-primary/5 の着色背景だと
                            // text-muted-foreground がコントラスト 4.5:1 未満（AA 未達）になるため背景は着色しない
                            pack.isRecommended && 'border-2 border-primary/50',
                        )}
                    >
                        <h3 className="flex items-center gap-2 font-semibold text-foreground text-lg">
                            {pack.displayName}
                            {pack.isRecommended && (
                                <span className="rounded-full border border-primary/50 px-2 py-0.5 font-semibold text-primary text-xs">
                                    おすすめ
                                </span>
                            )}
                        </h3>
                        <p className="font-bold text-3xl text-foreground">
                            {formatJpy(pack.amountJpy)}
                            <span className="ml-1 font-normal text-base text-muted-foreground">
                                / {pack.quantity} 枠
                            </span>
                        </p>
                        <ul className="flex flex-col gap-2 text-muted-foreground text-sm">
                            <li>1 ログあたり {Math.round(pack.amountJpy / pack.quantity)} 円</li>
                            {pack.discountLabel && <li className="text-primary">{pack.discountLabel}</li>}
                            <li>買い切りなので月額料金はかかりません</li>
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
};

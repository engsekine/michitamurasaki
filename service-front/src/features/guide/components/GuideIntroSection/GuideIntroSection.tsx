import Link from 'next/link';
import { Heading } from '@/shared/components/typography/Heading';

import { PAGE_DATA } from '../../constants';

/**
 * TOP ダッシュボード末尾に置く使い方ページの導入バナー（030-usage-guide）。
 * 紹介文は使い方ページの PAGE_DATA.description を単一の情報源として流用する。
 */
export const GuideIntroSection = () => {
    return (
        // 背景写真を見せるため max-w コンテナを突き抜けてビューポート全幅にする（「最近のダイブログ」と同じ full-bleed）
        <section
            aria-labelledby="guide-intro"
            className="-translate-x-1/2 relative isolate left-1/2 mt-20 mb-20 w-screen overflow-hidden py-20"
        >
            {/* 背景写真 + 可読性スクリム（ダーク時は濃く沈める） */}
            <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[url('/whale3.jpg')] bg-center bg-cover" />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/45 dark:bg-black/60" />
            <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 text-center">
                <div className="flex flex-col gap-2">
                    <Heading level={2} id="guide-intro" className="text-white">
                        使い方ガイド
                    </Heading>
                    <p className="text-sm text-white/80">{PAGE_DATA.description}</p>
                </div>
                {/* 暗い背景写真の上に置くため「ログを作成」と同じ透明ボタンにする */}
                <Link
                    href="/guide"
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-white/40 px-4 font-bold text-sm text-white transition-colors hover:bg-white/10"
                >
                    使い方を見る
                </Link>
            </div>
        </section>
    );
};

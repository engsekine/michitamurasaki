import { COPYRIGHT_HOLDER } from '@/shared/constants/site';

/**
 * 利用規約の本文（条項 + 制定日）。見出し h1 やページ余白は含まない。
 * `/terms` ページ（TermsView）と、新規登録時の同意モーダル（TermsAgreementField）の両方で再利用する。
 */
export const TermsContent = () => {
    return (
        <>
            <section className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">第1条（適用）</h2>
                <p className="text-muted-foreground leading-relaxed">
                    本規約は、当サービス（以下「本サービス」といいます）の利用に関する条件を定めるものです。ユーザーは本規約に同意のうえ、本サービスを利用するものとします。
                </p>
            </section>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">第2条（利用登録）</h2>
                <p className="text-muted-foreground leading-relaxed">
                    利用登録は、申請者が当サービスの定める方法により登録を申請し、当サービスがこれを承認することによって完了するものとします。
                </p>
            </section>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">第3条（禁止事項）</h2>
                <p className="text-muted-foreground leading-relaxed">
                    ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
                </p>
                <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
                    <li>法令または公序良俗に違反する行為</li>
                    <li>犯罪行為に関連する行為</li>
                    <li>サーバーまたはネットワークの機能を破壊・妨害する行為</li>
                    <li>他のユーザーに不利益・損害を与える行為</li>
                    <li>不正アクセスまたはこれを試みる行為</li>
                    <li>当サービスの運営を妨害する行為</li>
                </ul>
            </section>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">第4条（サービスの停止・変更）</h2>
                <p className="text-muted-foreground leading-relaxed">
                    当サービスは、以下の事由がある場合、ユーザーに事前に通知することなく、本サービスの全部または一部の提供を停止・中断・変更できるものとします。
                </p>
                <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
                    <li>システムの保守・点検・更新を行う場合</li>
                    <li>天災・停電等の不可抗力により提供が困難な場合</li>
                    <li>その他、当サービスが提供の停止を必要と判断した場合</li>
                </ul>
            </section>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">第5条（免責事項）</h2>
                <p className="text-muted-foreground leading-relaxed">
                    当サービスは、本サービスに起因してユーザーに生じたあらゆる損害について、当サービスの故意または重大な過失による場合を除き、一切の責任を負いません。
                </p>
            </section>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">第6条（利用規約の変更）</h2>
                <p className="text-muted-foreground leading-relaxed">
                    当サービスは、必要と判断した場合には、ユーザーに通知することなく本規約を変更できるものとします。変更後の利用規約は、当ページに掲載した時点から効力を生じるものとします。
                </p>
            </section>

            <footer className="mt-16 border-border border-t pt-8 text-muted-foreground text-sm">
                <p>制定日: 2026年4月20日</p>
                <p className="mt-1">{COPYRIGHT_HOLDER}</p>
            </footer>
        </>
    );
};

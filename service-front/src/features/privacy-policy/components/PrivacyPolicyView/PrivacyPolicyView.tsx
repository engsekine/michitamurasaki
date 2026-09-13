import { Heading } from '@/shared/components/typography/Heading';
import { COPYRIGHT_HOLDER } from '@/shared/constants/site';

export const PrivacyPolicyView = () => {
    return (
        <article className="mx-auto max-w-3xl px-4 py-16">
            <Heading level={1}>プライバシーポリシー</Heading>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">個人情報の収集について</h2>
                <p className="text-muted-foreground leading-relaxed">
                    当サービスでは、サービスの提供・改善のために、以下の個人情報を収集する場合があります。
                </p>
                <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
                    <li>メールアドレス</li>
                    <li>氏名</li>
                    <li>利用ログ・Cookie情報</li>
                </ul>
            </section>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">個人情報の利用目的</h2>
                <p className="text-muted-foreground leading-relaxed">収集した個人情報は、以下の目的で利用します。</p>
                <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
                    <li>サービスの提供・運営</li>
                    <li>ユーザーへの通知・連絡</li>
                    <li>サービスの改善・新機能の開発</li>
                    <li>利用規約に違反する行為への対応</li>
                </ul>
            </section>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">個人情報の第三者提供</h2>
                <p className="text-muted-foreground leading-relaxed">
                    当サービスでは、以下の場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
                </p>
                <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
                    <li>法令に基づく場合</li>
                    <li>人の生命・身体・財産の保護に必要な場合</li>
                    <li>公衆衛生・児童の健全な育成に必要な場合</li>
                </ul>
            </section>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">Cookieの使用について</h2>
                <p className="text-muted-foreground leading-relaxed">
                    当サービスでは、ユーザー体験の向上やアクセス解析のためにCookieを使用しています。ブラウザの設定によりCookieを無効にすることも可能ですが、一部の機能が利用できなくなる場合があります。
                </p>
            </section>

            <section className="mt-10 space-y-4">
                <h2 className="font-semibold text-foreground text-xl">プライバシーポリシーの変更</h2>
                <p className="text-muted-foreground leading-relaxed">
                    本ポリシーの内容は、法令の変更やサービス内容の変更に伴い、事前の通知なく変更する場合があります。変更後のプライバシーポリシーは、当ページに掲載した時点から効力を生じるものとします。
                </p>
            </section>

            <footer className="mt-16 border-border border-t pt-8 text-muted-foreground text-sm">
                <p>制定日: 2026年4月20日</p>
                <p className="mt-1">{COPYRIGHT_HOLDER}</p>
            </footer>
        </article>
    );
};

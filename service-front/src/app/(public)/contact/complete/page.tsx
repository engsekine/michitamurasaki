import Link from 'next/link';
import { COMPLETE_PAGE_DATA, PAGE_DATA } from '@/features/contact';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { buttonVariants } from '@/shared/components/ui/Button';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(COMPLETE_PAGE_DATA);

export default function ContactCompletePage() {
    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs
                breadcrumbs={[{ slug: PAGE_DATA.slug, name: PAGE_DATA.title }, { name: COMPLETE_PAGE_DATA.title }]}
            />
            <main className="mx-auto w-full max-w-2xl px-4 py-10">
                <Heading level={1} className="mb-4">
                    お問い合わせを受け付けました
                </Heading>
                <p className="mb-2 text-muted-foreground text-sm">
                    お問い合わせいただきありがとうございます。内容を確認のうえ、ご入力のメールアドレス宛にご連絡いたします。
                </p>
                <p className="mb-8 text-muted-foreground text-sm">お返事まで今しばらくお待ちください。</p>
                <div className="flex flex-wrap gap-2">
                    <Link href="/" className={buttonVariants({ variant: 'default' })}>
                        ホームへ戻る
                    </Link>
                    <Link href="/contact" className={buttonVariants({ variant: 'outline' })}>
                        続けてお問い合わせする
                    </Link>
                </div>
            </main>
        </div>
    );
}

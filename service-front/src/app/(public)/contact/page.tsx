import { ContactForm, getContactDefaultValues, PAGE_DATA } from '@/features/contact';
import { Breadcrumbs } from '@/shared/components/layout/Breadcrumbs';
import { Heading } from '@/shared/components/typography/Heading';
import { generatePageMetadata } from '@/shared/config/metadata';

export const metadata = generatePageMetadata(PAGE_DATA);

export default async function ContactPage() {
    // ログイン中なら氏名・メールを補完する（未ログインは空 / FR-013）
    const defaultValues = await getContactDefaultValues();

    return (
        <div className="flex flex-1 flex-col">
            <Breadcrumbs breadcrumbs={[{ name: PAGE_DATA.title }]} />
            <main className="mx-auto w-full max-w-2xl px-4 py-6">
                <Heading level={1} className="mb-2">
                    {PAGE_DATA.title}
                </Heading>
                <p className="mb-6 text-muted-foreground text-sm">
                    ご質問・ご要望・不具合のご連絡はこちらのフォームからお送りください。
                </p>
                <ContactForm defaultValues={defaultValues} />
            </main>
        </div>
    );
}

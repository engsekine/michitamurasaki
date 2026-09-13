import { TermsContent } from '@/features/terms/components/TermsContent';
import { Heading } from '@/shared/components/typography/Heading';

export const TermsView = () => {
    return (
        <article className="mx-auto max-w-3xl px-4 py-16">
            <Heading level={1} className="mb-10">
                利用規約
            </Heading>
            <TermsContent />
        </article>
    );
};

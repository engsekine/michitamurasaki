'use client';

import { Button } from '@/shared/components/ui/Button';

interface ErrorPageProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
            <h1 className="font-bold text-2xl text-foreground">エラーが発生しました</h1>
            <p className="text-muted-foreground text-sm">{error.message}</p>
            <Button type="button" size="lg" onClick={reset}>
                もう一度試す
            </Button>
        </main>
    );
}

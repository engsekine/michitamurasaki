'use client';

import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/Button';

/**
 * ユーザー検索フォーム（spec 021 / フォロー導線）。
 * ユーザー ID（handle）を入力して送信すると `/users/search?q=...` に遷移し、結果を再取得する。
 */
export const UserSearchBar = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') ?? '');

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = query.trim();
        const target = trimmed.length > 0 ? `/users/search?q=${encodeURIComponent(trimmed)}` : '/users/search';
        router.push(target as Route);
    };

    return (
        <search aria-label="ユーザー検索">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1">
                    <label htmlFor="user-search-query" className="font-medium text-sm">
                        ユーザーIDで探す
                    </label>
                    <input
                        id="user-search-query"
                        type="search"
                        name="q"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="ユーザーIDを入力"
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    />
                </div>
                <Button type="submit">検索</Button>
            </form>
        </search>
    );
};

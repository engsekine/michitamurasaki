'use client';

import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Award, LogOut, Search, Ticket, User, UserPlus } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { signOut } from '@/features/auth/server/actions';
import { Button } from '@/shared/components/ui/Button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/Sheet';
import { profilePath } from '@/shared/lib/profile-path';
import { createClient } from '@/shared/lib/supabase/browser';
import { useUserStore } from '@/shared/stores/user-store';

interface AuthNavProps {
    /** SSR でサーバーから取得した初期ユーザー（ハイドレーションのちらつき防止） */
    initialUser: SupabaseUser | null;
}

export const AuthNav = ({ initialUser }: AuthNavProps) => {
    const storeUser = useUserStore((s) => s.user);
    const setUser = useUserStore((s) => s.setUser);
    const clearUser = useUserStore((s) => s.clearUser);
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);

    /**
     * ハイドレート完了フラグ。
     * ハイドレート前は initialUser を、後はストアの値を採用することで、
     * SSR/CSR の初回レンダリング結果を一致させちらつきを防ぐ。
     */
    const [hasHydrated, setHasHydrated] = useState(false);

    /** SSR で取得した初期ユーザーをストアに同期 */
    useEffect(() => {
        if (initialUser) {
            setUser(initialUser);
        } else {
            clearUser();
        }
        setHasHydrated(true);
    }, [initialUser, setUser, clearUser]);

    /**
     * Supabase Auth の状態変化を監視してストアに反映。
     * INITIAL_SESSION は Cookie 復元前のタイミングで session=null で発火し
     * initialUser を上書きしてしまうため無視する（初期状態は SSR を信頼する）。
     */
    useEffect(() => {
        const supabase = createClient();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION') return;

            if (session?.user) {
                setUser(session.user);
            } else {
                clearUser();
            }
        });

        return () => subscription.unsubscribe();
    }, [setUser, clearUser]);

    const handleSignOut = () => {
        startTransition(async () => {
            await signOut();
            setIsOpen(false);
        });
    };

    const user = hasHydrated ? storeUser : initialUser;
    const isAuthenticated = !!user;

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={isAuthenticated ? 'アカウントメニューを開く' : 'ログインメニューを開く'}
                    />
                }
            >
                <User />
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>アカウント</SheetTitle>
                </SheetHeader>
                <nav aria-label="アカウントナビゲーション" className="flex flex-col gap-2 p-4">
                    {isAuthenticated ? (
                        <>
                            <p className="text-muted-foreground text-sm">
                                <span className="sr-only">ログイン中のメールアドレス: </span>
                                {user?.email}
                            </p>
                            {user?.id && (
                                <Link
                                    // 034: user_metadata の handle からユーザー ID の URL を生成する。
                                    // 未設定（同期前の Google 初回ユーザー等）は内部 ID URL となり、ページ側の転送で正規化される
                                    href={
                                        profilePath({
                                            userId: user.id,
                                            handle:
                                                typeof user.user_metadata?.['handle'] === 'string'
                                                    ? user.user_metadata['handle']
                                                    : null,
                                        }) as Route
                                    }
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                                >
                                    <User aria-hidden="true" />
                                    マイプロフィール
                                </Link>
                            )}
                            <Link
                                href="/users/search"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                            >
                                <Search aria-hidden="true" />
                                ユーザーを探す
                            </Link>
                            <Link
                                href="/settings/profile"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                            >
                                <User aria-hidden="true" />
                                会員情報
                            </Link>
                            <Link
                                href="/settings/certifications"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                            >
                                <Award aria-hidden="true" />
                                保有資格
                            </Link>
                            <Link
                                href="/settings/log-credits"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                            >
                                <Ticket aria-hidden="true" />
                                ログ枠の購入
                            </Link>
                            <Button
                                variant="outline"
                                onClick={handleSignOut}
                                disabled={isPending}
                                className="justify-start"
                            >
                                <LogOut aria-hidden="true" />
                                {isPending ? 'ログアウト中...' : 'ログアウト'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/signup"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                            >
                                <UserPlus aria-hidden="true" />
                                会員登録
                            </Link>
                            <Link
                                href="/login"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                            >
                                <User aria-hidden="true" />
                                ログイン
                            </Link>
                        </>
                    )}
                </nav>
            </SheetContent>
        </Sheet>
    );
};

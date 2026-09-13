'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

/** localStorage のテーマ保存キー（layout.tsx の FOUC 防止スクリプトと共有） */
export const THEME_STORAGE_KEY = 'theme';

/**
 * ダークモード切り替えトグル。
 * html 要素の `dark` クラスをトグルし、選択を localStorage に保存する。
 * 初期値は layout.tsx の beforeInteractive スクリプトが OS 設定から適用済み
 * （このコンポーネントは描画後の切り替えだけを担当する）。
 */
export const ThemeToggle = () => {
    const [isDark, setIsDark] = useState(false);

    /** SSR は現在テーマを知らないため、マウント後に html クラスから状態を同期する */
    useEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const handleToggle = () => {
        const next = !isDark;
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
        setIsDark(next);
    };

    return (
        <button
            type="button"
            aria-label="ダークモードを切り替える"
            aria-pressed={isDark}
            onClick={handleToggle}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
            <Sun aria-hidden="true" className="size-5 dark:hidden" />
            <Moon aria-hidden="true" className="hidden size-5 dark:block" />
        </button>
    );
};

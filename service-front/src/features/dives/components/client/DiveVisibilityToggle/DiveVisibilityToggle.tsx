'use client';

import { useState, useTransition } from 'react';

import { setDiveVisibility } from '@/features/dives/server/actions';
import { SITE_URL } from '@/shared/constants/site';

interface DiveVisibilityToggleProps {
    diveId: string;
    /** 初期の公開状態 */
    initialIsPublic: boolean;
}

/**
 * 共有リンクの絶対 URL。公開ログの閲覧は /dives/[id] に統合したため、dive id をそのまま使う。
 * 相対パスだと共有先で使えないため、正規ドメイン（SITE_URL）を前置する。所有者が今いるホスト
 * （window.location.origin＝プレビュー/localhost になりうる）ではなく sitemap 等と同じ
 * SITE_URL を基準にすることで、常に共有可能な正規 URL を渡せる。
 */
const shareUrl = (diveId: string): string => `${SITE_URL}/dives/${diveId}`;

/**
 * ログの公開/非公開トグル（spec 021 US2 / FR-007〜011）。
 * role="switch" で状態を伝え、切替時に setDiveVisibility を呼ぶ。
 * 公開中は共有リンク（/dives/[id]）を表示する（非公開化で即無効）。
 */
export const DiveVisibilityToggle = ({ diveId, initialIsPublic }: DiveVisibilityToggleProps) => {
    const [isPublic, setIsPublic] = useState(initialIsPublic);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleToggle = () => {
        const next = !isPublic;
        setError(null);
        startTransition(async () => {
            const result = await setDiveVisibility(diveId, next);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setIsPublic(result.isPublic);
            setIsCopied(false);
        });
    };

    // 表示している絶対 URL をそのままクリップボードへコピーする
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl(diveId));
            setIsCopied(true);
        } catch (copyError) {
            console.warn('[DiveVisibilityToggle] copy failed:', copyError);
            setError('共有リンクのコピーに失敗しました');
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    role="switch"
                    aria-checked={isPublic}
                    aria-label="このログを公開する"
                    aria-busy={isPending}
                    disabled={isPending}
                    onClick={handleToggle}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50 ${
                        isPublic ? 'bg-primary' : 'bg-muted-foreground/40'
                    }`}
                >
                    <span
                        aria-hidden="true"
                        className={`inline-block size-5 transform rounded-full bg-background transition-transform ${
                            isPublic ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                    />
                </button>
                <span className="text-sm">{isPublic ? '公開中' : '非公開'}</span>
            </div>

            {isPublic && (
                <div className="flex flex-col gap-1 text-sm">
                    <label htmlFor={`dive-share-url-${diveId}`} className="text-muted-foreground">
                        共有リンク
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* 絶対 URL を読み取り専用で表示。フォーカス/クリックで全選択し、そのまま直接コピーできる */}
                        <input
                            id={`dive-share-url-${diveId}`}
                            className="min-w-0 flex-1 rounded border border-input bg-muted px-2 py-1 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            type="text"
                            value={shareUrl(diveId)}
                            readOnly
                            onFocus={(event) => event.currentTarget.select()}
                            onClick={(event) => event.currentTarget.select()}
                        />
                        <button
                            type="button"
                            onClick={() => void handleCopy()}
                            className="shrink-0 rounded border border-input px-2 py-1 text-foreground text-xs hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                        >
                            {isCopied ? 'コピーしました' : 'コピー'}
                        </button>
                    </div>
                    <span role="status" aria-live="polite" className="sr-only">
                        {isCopied ? '共有リンクをコピーしました' : ''}
                    </span>
                </div>
            )}

            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {error}
                </p>
            )}
        </div>
    );
};

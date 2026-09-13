'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, buttonVariants } from '@/shared/components/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/Dialog';

interface DailyBonusModalProps {
    /** 付与後のログ枠残数。取得失敗時は null（枠数表示のみ省略し獲得の事実は伝える） */
    remainingCredits: number | null;
}

/**
 * デイリーボーナス獲得モーダル（spec 036）。
 * 付与が発生した訪問でのみ authenticated layout からマウントされるため初期状態で開く。
 * 同日再表示の抑止はサーバー側（grant_daily_bonus の false 返却）で担保されるので、
 * クライアントには開閉 state 以外の状態を持たない。
 * role="dialog"・フォーカストラップ・Esc クローズは Dialog ラッパー（@repo/ui）が満たす。
 */
export const DailyBonusModal = ({ remainingCredits }: DailyBonusModalProps) => {
    const [open, setOpen] = useState(true);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>デイリーボーナス獲得！</DialogTitle>
                    <DialogDescription>ログ枠が 1 つ増えました</DialogDescription>
                </DialogHeader>
                {remainingCredits !== null && <p className="text-sm">現在の残り枠: {remainingCredits}</p>}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        閉じる
                    </Button>
                    {/* 獲得した枠をそのままログ作成に使う導線（FR-004）。
                        モーダルは layout 配下にありクライアント遷移では unmount されないため、
                        クリック時に明示的に閉じる */}
                    <Link href="/dives/new" className={buttonVariants()} onClick={() => setOpen(false)}>
                        ログを書く
                    </Link>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

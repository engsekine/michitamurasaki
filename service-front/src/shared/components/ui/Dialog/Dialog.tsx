// shadcn / @repo/ui の Dialog ラッパー。service-front では @repo/ui を直接使わずここ経由で使う。
// 現状はスタイル変更なしの再 export。見た目を上書きしたくなったらこの窓口で行う（@repo/ui は無改変）。
export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
} from '@repo/ui/components/dialog';

'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { type PhotoFileMeta, photoValidationMessage, validateNewPhotos } from '@/features/dives/lib/photoValidation';
import { uploadDivePhotos } from '@/features/dives/lib/uploadDivePhotos';
import { buttonVariants } from '@/shared/components/ui/Button';

interface DivePhotoUploaderProps {
    diveId: string;
    /** 所有者の user_id（Storage パスの先頭。RLS と一致させる） */
    userId: string;
    /** 既存の添付枚数（上限判定に使う） */
    existingCount: number;
}

/**
 * 写真アップローダ（Client Component）。
 * ブラウザから原本を Storage に直アップロードし、Server Action `addDivePhoto` で
 * サーバー処理（変換・メタ除去）+ メタ登録を行う（research R2）。複数選択・部分失敗に対応する。
 */
export const DivePhotoUploader = ({ diveId, userId, existingCount }: DivePhotoUploaderProps) => {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [status, setStatus] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const resetInput = () => {
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length === 0) return;

        setErrors([]);
        setStatus('');

        const metas: PhotoFileMeta[] = files.map((file) => ({ name: file.name, size: file.size, type: file.type }));
        const validationErrors = validateNewPhotos(existingCount, metas);
        if (validationErrors.length > 0) {
            setErrors(validationErrors.map(photoValidationMessage));
            resetInput();
            return;
        }

        setIsUploading(true);
        setStatus(`${files.length} 枚をアップロード中…`);

        const { added, errors: uploadErrors } = await uploadDivePhotos(diveId, userId, files);

        setIsUploading(false);
        setStatus(added > 0 ? `${added} 枚の写真を追加しました` : '');
        setErrors(uploadErrors);
        resetInput();
        if (added > 0) router.refresh();
    };

    return (
        <div className="flex flex-col gap-2">
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className={buttonVariants({ variant: 'outline' })}
            >
                {isUploading ? 'アップロード中…' : '写真を追加'}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                multiple
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onChange={handleChange}
            />
            <p aria-live="polite" className="text-muted-foreground text-sm">
                {status}
            </p>
            {errors.length > 0 && (
                <div role="alert">
                    <ul className="flex flex-col gap-1 text-destructive text-sm">
                        {errors.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

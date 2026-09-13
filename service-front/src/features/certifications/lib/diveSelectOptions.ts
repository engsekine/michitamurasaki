import type { FormSelectOption } from '@/shared/components/form';
import { formatJstDate } from '@/shared/lib/date';

/** dives 由来の選択肢入力（feature 間 import を避けるため構造的型で受ける） */
interface DiveOptionInput {
    id: string;
    /** ダイブ日（YYYY-MM-DD） */
    diveDate: string;
    location: string;
}

/** 取得ダイブセレクト用に「YYYY/MM/DD ポイント名」のラベルへ変換する */
export const toDiveSelectOptions = (dives: DiveOptionInput[]): FormSelectOption[] =>
    dives.map((dive) => ({ value: dive.id, label: `${formatJstDate(dive.diveDate)} ${dive.location}` }));

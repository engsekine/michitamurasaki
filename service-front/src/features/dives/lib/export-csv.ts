// Dive[] → CSV 文字列（純粋関数）。UTF-8 BOM + RFC 4180。
// 列定義は specs/014-log-export/contracts/export-endpoint.md の CSV 列契約に従う。
import { TANK_TYPE_LABEL_MAP } from '@/features/dives/constants';
import { diveLocationLabel } from '@/features/dives/lib/diveLabel';
import type { Dive } from '@/features/dives/types';

/** Excel（日本語環境含む）で UTF-8 を文字化けさせないための BOM */
const BOM = '﻿';

interface CsvColumn {
    header: string;
    value: (dive: Dive) => string;
}

/** null / undefined を空文字に、数値は文字列化する */
const cell = (value: string | number | null | undefined): string =>
    value === null || value === undefined ? '' : String(value);

/** CSV 出力する列の定義（順序が出力順） */
const COLUMNS: CsvColumn[] = [
    { header: 'ダイブ番号', value: (d) => cell(d.diveNumber) },
    { header: '潜水日', value: (d) => d.diveDate },
    { header: 'エントリー時刻', value: (d) => cell(d.entryTime) },
    { header: 'エキジット時刻', value: (d) => cell(d.exitTime) },
    { header: 'ポイント', value: (d) => diveLocationLabel({ location: d.location, diveSite: d.diveSite }) },
    { header: 'エリア', value: (d) => cell(d.diveSite?.area ?? null) },
    { header: 'ダイブタイプ', value: (d) => cell(d.diveType) },
    { header: '天気', value: (d) => cell(d.weather) },
    { header: '気温(℃)', value: (d) => cell(d.airTempC) },
    { header: '水温(℃)', value: (d) => cell(d.waterTempC) },
    { header: '透明度(m)', value: (d) => cell(d.visibilityM) },
    { header: '波・うねり', value: (d) => cell(d.wave) },
    { header: '流れ', value: (d) => cell(d.currentCondition) },
    { header: '最大水深(m)', value: (d) => cell(d.maxDepthM) },
    { header: '平均水深(m)', value: (d) => cell(d.avgDepthM) },
    { header: '潜水時間(分)', value: (d) => cell(d.bottomTimeMin) },
    { header: 'タンク種類', value: (d) => (d.tankType ? TANK_TYPE_LABEL_MAP[d.tankType] : '') },
    { header: 'タンク容量(L)', value: (d) => cell(d.tankVolumeL) },
    { header: 'ガス種類', value: (d) => cell(d.gasType) },
    { header: '酸素濃度(%)', value: (d) => cell(d.o2Percent) },
    { header: '開始残圧(bar)', value: (d) => cell(d.pressureStartBar) },
    { header: '終了残圧(bar)', value: (d) => cell(d.pressureEndBar) },
    { header: 'ウェイト(kg)', value: (d) => cell(d.weightKg) },
    { header: 'スーツ', value: (d) => cell(d.suitType) },
    { header: '装備メモ', value: (d) => cell(d.equipmentNotes) },
    { header: 'バディ', value: (d) => cell(d.buddyName) },
    { header: 'インストラクター', value: (d) => cell(d.instructorName) },
    { header: '講習ダイブ', value: (d) => (d.certificationDive ? 'はい' : '') },
    { header: 'メモ', value: (d) => cell(d.notes) },
];

/** 純粋な数値表現（負数・小数含む）。数式ガードの対象外にする */
const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * CSV/数式インジェクション対策: `= + - @` 始まりのセルは Excel 等で数式として
 * 評価されうるため、先頭に `'` を付けて無害化する。
 * 負数などの純粋な数値はデータとして正しいため対象外とする。
 */
const guardFormula = (value: string): string =>
    /^[=+\-@]/.test(value) && !NUMERIC_PATTERN.test(value) ? `'${value}` : value;

/** RFC 4180: 値に `,` `"` 改行を含む場合のみ `"` で囲み、内部の `"` を `""` にする */
const escapeField = (value: string): string => {
    const guarded = guardFormula(value);
    return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

const toLine = (fields: string[]): string => fields.map(escapeField).join(',');

/**
 * Dive[] を CSV 文字列に変換する。
 * 先頭に BOM、ヘッダー行 + 1 ダイブ 1 行、改行は CRLF。0 件はヘッダー行のみ。
 */
export const divesToCsv = (dives: Dive[]): string => {
    const header = toLine(COLUMNS.map((column) => column.header));
    const rows = dives.map((dive) => toLine(COLUMNS.map((column) => column.value(dive))));
    return `${BOM}${[header, ...rows].join('\r\n')}\r\n`;
};

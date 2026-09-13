/**
 * ダイブログの入力スキーマ（実体は @repo/core / 029 でモバイルと共有化）。
 * 既存の import パス互換のための re-export。編集は packages/core/src/schemas/dive.schema.ts で行う。
 */
export { type DiveFormValues, type DiveSearchValues, diveSchema, diveSearchSchema } from '@repo/core';

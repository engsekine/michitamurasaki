/**
 * 汎用テーブルエディタで扱える public テーブルの許可リスト（FR-017）。
 * 認証基盤（auth スキーマ）・管理者識別（admin_users）・監査ログ（admin_audit_logs）・
 * 専用画面を持つ主要エンティティ（users / dives / dive_sites）はここに含めない。
 */
export interface TableEditorConfig {
    /** 表示ラベル */
    label: string;
    /** キーワード検索対象カラム（許可リスト。空なら検索不可） */
    searchColumns: readonly string[];
    /** 並び替え許可カラム */
    sortableColumns: readonly string[];
    /** deleted_at を持つか */
    hasDeletedAt: boolean;
    /**
     * 削除を許可するか。ユーザープロフィール（user_details）は
     * 物理削除を MVP 対象外とする data-model の方針に従い削除不可（FR-018）。
     */
    deletable: boolean;
    /**
     * on delete cascade で連鎖削除される子テーブル。
     * FK は 23503 にならず子行が無警告で消えるため、削除前に参照件数を確認して
     * 参照ありはブロックする（FR-014 の巻き込み削除防止）。
     */
    cascadeChild?: { table: string; fkColumn: string };
}

export const ALLOWED_TABLES = {
    user_details: {
        label: 'ユーザー詳細',
        searchColumns: ['nickname', 'last_name', 'first_name'],
        sortableColumns: ['created_at'],
        hasDeletedAt: false,
        deletable: false,
    },
    certifications: {
        label: '資格',
        searchColumns: [],
        sortableColumns: ['created_at'],
        hasDeletedAt: false,
        deletable: true,
        cascadeChild: { table: 'certification_tags', fkColumn: 'certification_id' },
    },
    certification_tags: {
        label: '資格タグ',
        searchColumns: [],
        sortableColumns: [],
        hasDeletedAt: false,
        deletable: true,
    },
    dive_plans: {
        label: 'ダイブプラン',
        searchColumns: [],
        sortableColumns: ['created_at'],
        hasDeletedAt: false,
        deletable: true,
        cascadeChild: { table: 'plan_packing_items', fkColumn: 'plan_id' },
    },
    plan_packing_items: {
        label: '持ち物',
        searchColumns: [],
        sortableColumns: [],
        hasDeletedAt: false,
        deletable: true,
    },
    regulators: {
        label: 'レギュレータ',
        searchColumns: [],
        sortableColumns: ['created_at'],
        hasDeletedAt: false,
        deletable: true,
    },
} as const satisfies Record<string, TableEditorConfig>;

export type AllowedTable = keyof typeof ALLOWED_TABLES;

/** 許可リストに含まれるテーブルかを型ガードで判定する */
export const isAllowedTable = (name: string): name is AllowedTable => Object.hasOwn(ALLOWED_TABLES, name);

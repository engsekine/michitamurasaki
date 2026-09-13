import type { Database } from '@repo/supabase';

type DiveShopRow = Database['public']['Tables']['dive_shops']['Row'];

/** ダイビングショップ（本人のみ参照可のプライベートデータ） */
export interface Shop {
    id: string;
    name: string;
    address: string;
    phone: string;
    websiteUrl: string;
    memo: string;
    /** 住所のジオコーディング結果。住所未入力・解決失敗時は null（longitude とセット） */
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
    updatedAt: string;
}

/** フォームの選択肢用の軽量版（予定・ログ・シートの page から props 注入する） */
export interface ShopOption {
    id: string;
    name: string;
}

/** 一覧カード表示に必要な項目だけの軽量版（getShops の select と同期） */
export type ShopListItem = Pick<Shop, 'id' | 'name' | 'address' | 'phone'>;

/** 住所→座標の解決結果。特定できない場合は両方 null */
export interface GeocodeResult {
    latitude: number | null;
    longitude: number | null;
}

/** ショップ詳細の逆引き一覧に表示する予定 */
export interface LinkedPlan {
    id: string;
    plannedOn: string;
    location: string;
}

/** ショップ詳細の逆引き一覧に表示するログ */
export interface LinkedDive {
    id: string;
    diveDate: string;
    location: string;
}

/** DB row → Shop 変換 */
export const mapShop = (row: DiveShopRow): Shop => ({
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    websiteUrl: row.website_url,
    memo: row.memo,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

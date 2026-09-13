// dives 行 → ドメイン型 Dive への変換（純粋関数）。
// サーバークエリ（queries.ts）とエクスポート（export-query.ts）の双方から使うため、
// 'server-only' は付けず I/O を持たない。
import type { Database } from '@repo/supabase';

import type { TankTypeValue } from '@/features/dives/constants';
import type { Dive, DiveShopRef, DiveSiteRef } from '@/features/dives/types';
import { toNumber } from '@/shared/lib/number';

type DiveRow = Database['public']['Tables']['dives']['Row'];

/** dive_sites / dive_shops を to-one 結合した行（`dive_site:dive_sites(...)` / `dive_shop:dive_shops(...)`） */
export type DiveRowWithSite = DiveRow & { dive_site: DiveSiteRef | null; dive_shop?: DiveShopRef | null };

/** dives に結合するダイブサイトの select 句（表示名解決用） */
export const DIVE_SITE_JOIN = 'dive_site:dive_sites(id, name, area)';

/** dives に結合するショップの select 句（033。RLS により本人のショップ以外は null になる） */
export const DIVE_SHOP_JOIN = 'dive_shop:dive_shops(id, name)';

/** dives の全カラム + dive_site / dive_shop 結合の select 句（詳細・エクスポートで全項目を取得する） */
export const DIVE_FULL_COLUMNS = `*, ${DIVE_SITE_JOIN}, ${DIVE_SHOP_JOIN}`;

/**
 * DB の snake_case 行をドメイン型 Dive に変換する。
 * numeric カラムは Supabase 経由で string になることがあるため数値へ正規化する。
 */
export const mapDive = (row: DiveRowWithSite): Dive => ({
    id: row.id,
    userId: row.user_id,
    diveNumber: row.dive_number,
    diveDate: row.dive_date,
    entryTime: row.entry_time,
    exitTime: row.exit_time,
    location: row.location,
    diveSiteId: row.dive_site_id,
    diveSite: row.dive_site ? { id: row.dive_site.id, name: row.dive_site.name, area: row.dive_site.area } : null,
    diveShopId: row.dive_shop_id,
    shop: row.dive_shop ? { id: row.dive_shop.id, name: row.dive_shop.name } : null,
    diveType: row.dive_type,
    weather: row.weather,
    airTempC: toNumber(row.air_temp_c),
    waterTempC: toNumber(row.water_temp_c),
    visibilityM: toNumber(row.visibility_m),
    wave: row.wave,
    currentCondition: row.current_condition,
    maxDepthM: Number(row.max_depth_m),
    avgDepthM: toNumber(row.avg_depth_m),
    bottomTimeMin: row.bottom_time_min,
    // DB 側は CHECK 制約で選択肢を保証しているため、ここでは型を狭めるだけ
    tankType: row.tank_type as TankTypeValue | null,
    tankVolumeL: toNumber(row.tank_volume_l),
    gasType: row.gas_type,
    o2Percent: toNumber(row.o2_percent),
    pressureStartBar: row.pressure_start_bar,
    pressureEndBar: row.pressure_end_bar,
    weightKg: toNumber(row.weight_kg),
    suitType: row.suit_type,
    equipmentNotes: row.equipment_notes,
    buddyName: row.buddy_name,
    instructorName: row.instructor_name,
    certificationDive: row.certification_dive,
    notes: row.notes,
    isPublic: row.is_public,
    publicSlug: row.public_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

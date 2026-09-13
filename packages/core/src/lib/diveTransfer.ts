import type { DiveFormValues } from '../schemas/dive.schema';

/**
 * dives テーブルへの INSERT 行（snake_case）。
 * @repo/supabase の生成型と構造互換（core を DB 型に依存させないため自前定義）。
 * buddies（登録ユーザーのタグ付け = dive_log_buddies）は 029 のスコープ外のため含まない。
 */
export interface DiveInsertRow {
    id: string;
    user_id: string;
    dive_date: string;
    max_depth_m: number;
    bottom_time_min: number;
    dive_number: number | null;
    entry_time: string | null;
    exit_time: string | null;
    dive_site_id: string | null;
    location: string | null;
    dive_type: string | null;
    weather: string | null;
    air_temp_c: number | null;
    water_temp_c: number | null;
    visibility_m: number | null;
    wave: string | null;
    current_condition: string | null;
    avg_depth_m: number | null;
    tank_type: string | null;
    tank_volume_l: number | null;
    gas_type: string | null;
    o2_percent: number | null;
    pressure_start_bar: number | null;
    pressure_end_bar: number | null;
    weight_kg: number | null;
    suit_type: string | null;
    equipment_notes: string | null;
    buddy_name: string | null;
    instructor_name: string | null;
    certification_dive: boolean;
    notes: string | null;
    is_public: boolean;
}

/**
 * フォーム入力（diveSchema.cast 済み）を dives の INSERT 行へ変換する（029 / FR-005・FR-008）。
 * id はクライアント採番の UUID（= 冪等キー）、user_id はセッションユーザーを渡す。
 */
export const toDiveInsertRow = (values: DiveFormValues, ids: { id: string; userId: string }): DiveInsertRow => ({
    id: ids.id,
    user_id: ids.userId,
    dive_date: values.diveDate,
    max_depth_m: values.maxDepthM,
    bottom_time_min: values.bottomTimeMin,
    dive_number: values.diveNumber ?? null,
    entry_time: values.entryTime ?? null,
    exit_time: values.exitTime ?? null,
    dive_site_id: values.diveSiteId ?? null,
    location: values.location ?? null,
    dive_type: values.diveType ?? null,
    weather: values.weather ?? null,
    air_temp_c: values.airTempC ?? null,
    water_temp_c: values.waterTempC ?? null,
    visibility_m: values.visibilityM ?? null,
    wave: values.wave ?? null,
    current_condition: values.currentCondition ?? null,
    avg_depth_m: values.avgDepthM ?? null,
    tank_type: values.tankType ?? null,
    tank_volume_l: values.tankVolumeL ?? null,
    gas_type: values.gasType ?? null,
    o2_percent: values.o2Percent ?? null,
    pressure_start_bar: values.pressureStartBar ?? null,
    pressure_end_bar: values.pressureEndBar ?? null,
    weight_kg: values.weightKg ?? null,
    suit_type: values.suitType ?? null,
    equipment_notes: values.equipmentNotes ?? null,
    buddy_name: values.buddyName ?? null,
    instructor_name: values.instructorName ?? null,
    certification_dive: values.certificationDive,
    notes: values.notes ?? null,
    is_public: values.isPublic,
});

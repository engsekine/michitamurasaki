-- ========================================
-- user_details の氏名・ニックネームに上限 CHECK を追加（セキュリティ監査対応 2026-09）
--
-- 問題: last_name / first_name / *_romaji / nickname は `length(trim(x)) > 0` のみで上限が無く、
--       handle_new_user（raw_user_meta_data 取り込み）と本人の UPDATE ポリシーのどちらからでも
--       巨大文字列を保存できた（管理画面の描画破壊・ストレージ濫用）。
--
-- 対応: アプリの yup スキーマ（shared/schemas/user-profile.ts: 各 50 文字）と同じ上限を DB でも強制する。
--       既存行に上限超過があっても本マイグレーションを失敗させないため `not valid` で追加する
--       （新規 INSERT / UPDATE には即時適用される）。既存データの確認後に
--       `alter table public.user_details validate constraint <name>;` を別マイグレーションで実行すること。
-- ========================================

alter table public.user_details
    add constraint user_details_last_name_len_check
        check (char_length(last_name) <= 50) not valid,
    add constraint user_details_first_name_len_check
        check (char_length(first_name) <= 50) not valid,
    add constraint user_details_last_name_romaji_len_check
        check (char_length(last_name_romaji) <= 50) not valid,
    add constraint user_details_first_name_romaji_len_check
        check (char_length(first_name_romaji) <= 50) not valid,
    add constraint user_details_nickname_len_check
        check (char_length(nickname) <= 50) not valid;

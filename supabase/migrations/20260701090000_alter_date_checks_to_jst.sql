-- 日付系 CHECK 制約の「未来日」判定を JST 基準に統一する。
--
-- 背景: アプリは JST 前提（service-front は todayInJst() で検証）だが、DB の CURRENT_DATE は
-- サーバ TZ（UTC）依存。UTC が前日扱いの時間帯（JST 0:00〜8:59）に「JST の今日」を保存しようとすると
-- クライアント検証は通るのに DB の `<= CURRENT_DATE`（UTC）で弾かれていた（dives_dive_date_check 23514）。
-- そこで各テーブルの未来日上限を `(now() at time zone 'Asia/Tokyo')::date` に置き換え、アプリと整合させる。
-- now() は STABLE で、CHECK は INSERT/UPDATE 時のみ評価されるため CURRENT_DATE と同じ運用になる。

-- dives: 潜水日は JST の今日まで
alter table public.dives drop constraint dives_dive_date_check;
alter table public.dives add constraint dives_dive_date_check
    check (dive_date >= '1900-01-01' and dive_date <= (now() at time zone 'Asia/Tokyo')::date);

-- regulators: オーバーホール日は JST の今日まで
alter table public.regulators drop constraint regulators_last_overhauled_on_check;
alter table public.regulators add constraint regulators_last_overhauled_on_check
    check (last_overhauled_on >= '1900-01-01' and last_overhauled_on <= (now() at time zone 'Asia/Tokyo')::date);

-- user_details: 生年月日は JST の今日まで
alter table public.user_details drop constraint user_details_birth_on_check;
alter table public.user_details add constraint user_details_birth_on_check
    check (birth_on >= '1900-01-01' and birth_on <= (now() at time zone 'Asia/Tokyo')::date);

-- certifications: 取得日は JST の翌日まで（元の CURRENT_DATE + 1 ＝ 翌日許容の意図を維持）
alter table public.certifications drop constraint certifications_acquired_on_check;
alter table public.certifications add constraint certifications_acquired_on_check
    check (acquired_on >= '1900-01-01' and acquired_on <= (now() at time zone 'Asia/Tokyo')::date + 1);

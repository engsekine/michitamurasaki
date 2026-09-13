-- ========================================
-- 026-log-monetization: ログ枠（クレジット）の基盤
--
-- ログの新規作成を「ログ枠」の消費で管理する。
-- - log_credit_ledger: 枠の増減 1 件ごとの追記専用記録（これが正）
-- - log_credit_balances: 現在残高。ledger の sum(amount) と常に一致する
--   ※ 残枠はヘッダー等で毎リクエスト表示するため、都度集計を避ける
--     性能目的の意図的な非正規化。更新は apply_credit_ledger_entry() に
--     閉じ、同一トランザクションで ledger と必ず両方書いて整合を担保する
-- - log_credit_purchases: 買い切りログパックの購入記録（Stripe 連携）
-- ========================================

-- ========================================
-- 購入記録（ledger が FK 参照するため先に作成）
-- ========================================
create table public.log_credit_purchases (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    quantity integer not null check (quantity > 0),
    amount_jpy integer not null check (amount_jpy >= 0),
    status text not null default 'pending'
        check (status in ('pending', 'completed', 'failed', 'refunded')),
    stripe_checkout_session_id text not null unique,
    stripe_payment_intent_id text,
    credited_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.log_credit_purchases is 'ログパック（買い切り）の購入 1 件。quantity / amount_jpy は購入時点のスナップショットで、価格改定が過去履歴に影響しない';
comment on column public.log_credit_purchases.stripe_checkout_session_id is 'Stripe Checkout Session ID。ユニーク制約が webhook 重複処理の冪等キーになる';
comment on column public.log_credit_purchases.credited_at is '枠付与の完了時刻。null なら未付与。where credited_at is null の条件付き更新で二重付与を防ぐ';

create index idx_log_credit_purchases_user_id_created_at
    on public.log_credit_purchases (user_id, created_at desc);

create trigger log_credit_purchases_handle_updated_at
    before update on public.log_credit_purchases
    for each row
    execute function public.handle_updated_at();

-- ========================================
-- 枠の増減記録（追記専用・正）
-- ========================================
create table public.log_credit_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    kind text not null
        check (kind in ('initial_grant', 'daily_bonus', 'purchase', 'consumption', 'refund_adjustment')),
    amount integer not null check (amount <> 0),
    granted_on date,
    dive_id uuid references public.dives(id) on delete set null,
    purchase_id uuid references public.log_credit_purchases(id) on delete restrict,
    stripe_refund_id text unique,
    created_at timestamptz not null default now(),
    -- granted_on はデイリーボーナスのみ・必須（部分ユニークの冪等キー）
    constraint log_credit_ledger_granted_on_check
        check ((kind = 'daily_bonus') = (granted_on is not null)),
    -- dive_id は consumption のみ。対象ログ削除時の on delete set null を許すため
    -- 「consumption なら必須」とはせず、insert 時の必須はトリガー実装で担保する
    constraint log_credit_ledger_dive_id_check
        check (dive_id is null or kind = 'consumption'),
    -- purchase / refund_adjustment は購入への参照が必須
    constraint log_credit_ledger_purchase_id_check
        check ((kind in ('purchase', 'refund_adjustment')) = (purchase_id is not null))
);

comment on table public.log_credit_ledger is 'ログ枠の増減 1 件ごとの追記専用記録。残高はこの合計と常に一致する（FR-016）';
comment on column public.log_credit_ledger.granted_on is 'デイリーボーナスの JST 暦日。(user_id, granted_on) 部分ユニークで 1 日 1 回を保証';
comment on column public.log_credit_ledger.stripe_refund_id is 'Stripe Refund ID。ユニーク制約が返金調整の冪等キーになる';

-- デイリーボーナスは 1 日（JST）1 回のみ（FR-003 の冪等性を DB で保証）
create unique index log_credit_ledger_user_id_granted_on_key
    on public.log_credit_ledger (user_id, granted_on)
    where kind = 'daily_bonus';

create index idx_log_credit_ledger_user_id_created_at
    on public.log_credit_ledger (user_id, created_at desc);

-- FK インデックス（PostgreSQL は自動生成しない）
create index idx_log_credit_ledger_dive_id on public.log_credit_ledger (dive_id);
create index idx_log_credit_ledger_purchase_id on public.log_credit_ledger (purchase_id);

-- ========================================
-- 残高キャッシュ
-- ========================================
create table public.log_credit_balances (
    user_id uuid primary key references public.users(id) on delete cascade,
    balance integer not null default 0 check (balance >= 0),
    updated_at timestamptz not null default now()
);

comment on table public.log_credit_balances is '現在の残枠。ledger の集計キャッシュ（性能目的の非正規化）。check (balance >= 0) が超過消費の最後の防壁';

-- ========================================
-- 関数: apply_credit_ledger_entry
-- 枠の増減の唯一の書き込み口。残高行をロックしてから ledger 追記 + 残高更新を
-- 同一トランザクションで行う。残高が負になる場合は check 違反で全体ロールバック。
-- ========================================
create or replace function public.apply_credit_ledger_entry(
    p_user_id uuid,
    p_kind text,
    p_amount integer,
    p_granted_on date default null,
    p_dive_id uuid default null,
    p_purchase_id uuid default null,
    p_stripe_refund_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_ledger_id uuid;
begin
    -- 残高行を確保（初回はここで作成）
    insert into public.log_credit_balances (user_id, balance)
    values (p_user_id, 0)
    on conflict (user_id) do nothing;

    -- 行ロックで同時消費を直列化（残枠 1 への並行リクエスト対策）
    perform 1 from public.log_credit_balances where user_id = p_user_id for update;

    insert into public.log_credit_ledger (user_id, kind, amount, granted_on, dive_id, purchase_id, stripe_refund_id)
    values (p_user_id, p_kind, p_amount, p_granted_on, p_dive_id, p_purchase_id, p_stripe_refund_id)
    returning id into v_ledger_id;

    update public.log_credit_balances
    set balance = balance + p_amount,
        updated_at = now()
    where user_id = p_user_id;

    return v_ledger_id;
end;
$$;

comment on function public.apply_credit_ledger_entry is 'ログ枠増減の唯一の書き込み口。クライアントからの直接実行は禁止（execute 権限を付与しない）';

-- ========================================
-- 関数: grant_daily_bonus（RPC・authenticated 実行可）
-- JST 暦日で 1 日 1 回、+1 枠。付与済みなら no-op（冪等）。
-- ========================================
create or replace function public.grant_daily_bonus()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := (select auth.uid());
begin
    if v_user_id is null then
        raise exception 'authentication required' using errcode = '28000';
    end if;

    begin
        perform public.apply_credit_ledger_entry(
            v_user_id,
            'daily_bonus',
            1,
            (now() at time zone 'Asia/Tokyo')::date
        );
    exception
        when unique_violation then
            -- 当日分は付与済み（部分ユニークにより並行呼び出しでも 1 回のみ）
            null;
    end;
end;
$$;

-- ========================================
-- 関数 + トリガー: consume_log_credit（dives AFTER INSERT）
-- 全作成経路（createDive / createDiveFromPlan / 将来の経路）で 1 枠を原子的に消費。
-- AFTER INSERT である理由: ledger.dive_id の FK が dives 行の存在を要求するため。
-- 例外時は同一トランザクションごとロールバックされ、ログも作られない。
-- 導入前の既存行・UPDATE・DELETE には影響しない（FR-009/010/011）。
-- ========================================
create or replace function public.consume_log_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    begin
        perform public.apply_credit_ledger_entry(new.user_id, 'consumption', -1, null, new.id);
    exception
        when check_violation then
            -- balance >= 0 違反 = 残枠不足。
            -- アプリ層は detail = 'no_credit' で判別する。
            -- 独自 errcode（P0026 等）は PostgREST が 500 に握りつぶすため、
            -- 標準の P0001（raise exception）+ DETAIL をセンチネルにする
            raise exception 'ログ枠がありません' using detail = 'no_credit';
    end;
    return new;
end;
$$;

create trigger dives_consume_log_credit
    after insert on public.dives
    for each row
    execute function public.consume_log_credit();

-- ========================================
-- 関数の execute 権限（CRITICAL / analyze C1）
-- PostgREST は public の関数を RPC 公開し、関数はデフォルトで PUBLIC に
-- execute が付与されるため、明示的に剥奪してから必要なロールへだけ付与する。
-- これを怠ると authenticated が rpc('apply_credit_ledger_entry') で枠を自己付与できてしまう。
-- ========================================
revoke execute on function public.apply_credit_ledger_entry(uuid, text, integer, date, uuid, uuid, text)
    from public, anon, authenticated;
grant execute on function public.apply_credit_ledger_entry(uuid, text, integer, date, uuid, uuid, text)
    to service_role;

revoke execute on function public.grant_daily_bonus() from public, anon;
grant execute on function public.grant_daily_bonus() to authenticated, service_role;

revoke execute on function public.consume_log_credit() from public, anon, authenticated;

-- ========================================
-- RLS
-- 読み取りは本人のみ。書き込みポリシーは意図的に作らない
-- （増減は security definer 関数経由・購入確定は webhook の service_role のみ）
-- ========================================
alter table public.log_credit_ledger enable row level security;
alter table public.log_credit_balances enable row level security;
alter table public.log_credit_purchases enable row level security;

create policy "users can read own credit ledger"
    on public.log_credit_ledger for select
    using ((select auth.uid()) = user_id);

create policy "users can read own credit balance"
    on public.log_credit_balances for select
    using ((select auth.uid()) = user_id);

create policy "users can read own purchases"
    on public.log_credit_purchases for select
    using ((select auth.uid()) = user_id);

-- ========================================
-- 既存ユーザーへの初期枠バックフィル（FR-008）
-- 新規ユーザーは handle_new_user（別マイグレーション）で付与する
-- ========================================
insert into public.log_credit_ledger (user_id, kind, amount)
select id, 'initial_grant', 10
from public.users;

insert into public.log_credit_balances (user_id, balance)
select id, 10
from public.users;

-- ========================================
-- 通知メール送信失敗時の取り消し用関数（厳密通知 / FR-023）
-- 仕様: specs/020-contact-page/data-model.md
--
-- 「保存（submit_inquiry）成功 → 通知メール送信失敗」のとき、保存済みの行を取り消す。
-- これがないと、再送時に同一本文の重複ガード（submit_inquiry）に当たり再送できない。
-- 直近 2 分以内に作成された当該 id の行のみ削除する（id は submit_inquiry の戻り値として
-- 送信者にのみ返されるため、第三者は対象行を特定できない）。
-- ========================================

create or replace function public.discard_recent_inquiry(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    delete from public.inquiries
    where id = p_id
      and created_at > now() - interval '2 minutes';
end;
$$;

comment on function public.discard_recent_inquiry is '通知メール送信に失敗した直後のお問い合わせ行を取り消す（厳密通知の再送時に重複ガードへ当たるのを防ぐ）。直近 2 分以内の当該 id のみ削除する';

revoke all on function public.discard_recent_inquiry(uuid) from public;
grant execute on function public.discard_recent_inquiry(uuid) to anon, authenticated;

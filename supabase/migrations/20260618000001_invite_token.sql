-- スタッフ招待トークン追加
-- 2026-06-18

alter table staff add column if not exists invite_token text unique;

grant all on staff to service_role;

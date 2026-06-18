-- 店舗に都道府県を追加（最低賃金チェック用）
alter table shops add column if not exists prefecture text;
grant all on shops to service_role;

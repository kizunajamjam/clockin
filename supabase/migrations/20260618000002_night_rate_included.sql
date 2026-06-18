-- 深夜割増込み賃金フラグ
-- 夜勤専従スタッフ等、時給に深夜割増が既に含まれている場合にtrueにする
-- trueの場合、22:00〜5:00の時間帯でも深夜割増を加算しない
alter table shop_staff add column night_rate_included boolean not null default false;

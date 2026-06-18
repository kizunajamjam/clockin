-- clockin 初期スキーマ
-- 2026-06-18

-- ────────────────────────────────────────────
-- extensions
-- ────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────
-- organizations
-- ────────────────────────────────────────────
create table organizations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  owner_user_id    uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now()
);

alter table organizations enable row level security;

create policy "オーナーのみ参照・更新" on organizations
  for all using (owner_user_id = auth.uid());

-- ────────────────────────────────────────────
-- subscriptions
-- ────────────────────────────────────────────
create table subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references organizations(id) on delete cascade,
  stripe_customer_id        text,
  stripe_subscription_id    text,
  status                    text not null default 'free'
                              check (status in ('free','active','trialing','canceled','past_due')),
  seat_count                integer not null default 0,
  current_period_end        timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table subscriptions enable row level security;

create policy "オーナーのみ参照" on subscriptions
  for select using (
    organization_id in (
      select id from organizations where owner_user_id = auth.uid()
    )
  );

create policy "service_role 書き込み" on subscriptions
  for all using (auth.role() = 'service_role');

-- ────────────────────────────────────────────
-- shops
-- ────────────────────────────────────────────
create table shops (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  timezone         text not null default 'Asia/Tokyo',
  punch_modes      text[] not null default '{tablet,smartphone}',
  gps_lat          float8,
  gps_lng          float8,
  gps_radius_m     integer not null default 300,
  gps_enabled      boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table shops enable row level security;

create policy "オーナー全操作" on shops
  for all using (
    organization_id in (
      select id from organizations where owner_user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────
-- staff
-- ────────────────────────────────────────────
create table staff (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  user_id               uuid references auth.users(id) on delete set null,
  name                  text not null,
  gender                text check (gender in ('male','female','other')),
  email                 text,
  pin                   text,
  income_alert_amount   integer,
  created_at            timestamptz not null default now()
);

alter table staff enable row level security;

create policy "オーナー全操作" on staff
  for all using (
    organization_id in (
      select id from organizations where owner_user_id = auth.uid()
    )
  );

create policy "本人参照" on staff
  for select using (user_id = auth.uid());

-- ────────────────────────────────────────────
-- shop_staff（所属・店舗別給与設定）
-- ────────────────────────────────────────────
create table shop_staff (
  id                    uuid primary key default gen_random_uuid(),
  shop_id               uuid not null references shops(id) on delete cascade,
  staff_id              uuid not null references staff(id) on delete cascade,
  role                  text not null default 'staff'
                          check (role in ('staff','manager')),
  hourly_rate           integer not null,
  transport_fee         integer not null default 0,
  transport_fee_type    text not null default 'daily'
                          check (transport_fee_type in ('daily','monthly')),
  night_rate_included   boolean not null default false,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (shop_id, staff_id)
);

alter table shop_staff enable row level security;

create policy "オーナー全操作" on shop_staff
  for all using (
    shop_id in (
      select id from shops where organization_id in (
        select id from organizations where owner_user_id = auth.uid()
      )
    )
  );

create policy "本人参照" on shop_staff
  for select using (
    staff_id in (select id from staff where user_id = auth.uid())
  );

-- shop_staffが作成された後にshopsのスタッフ参照ポリシーを追加
create policy "所属スタッフ参照" on shops
  for select using (
    id in (
      select shop_id from shop_staff where staff_id in (
        select id from staff where user_id = auth.uid()
      )
    )
  );

-- ────────────────────────────────────────────
-- shifts
-- ────────────────────────────────────────────
create table shifts (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops(id) on delete cascade,
  staff_id         uuid not null references staff(id) on delete cascade,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  break_minutes    integer not null default 0,
  note             text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table shifts enable row level security;

create policy "オーナー・マネージャー全操作" on shifts
  for all using (
    shop_id in (
      select id from shops where organization_id in (
        select id from organizations where owner_user_id = auth.uid()
      )
    )
  );

create policy "本人参照" on shifts
  for select using (
    staff_id in (select id from staff where user_id = auth.uid())
  );

-- ────────────────────────────────────────────
-- attendances
-- ────────────────────────────────────────────
create table attendances (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops(id) on delete cascade,
  staff_id         uuid not null references staff(id) on delete cascade,
  date             date not null,
  clocked_in_at    timestamptz,
  clocked_out_at   timestamptz,
  break_minutes    integer not null default 0,
  punch_mode       text check (punch_mode in ('tablet','smartphone')),
  gps_lat          float8,
  gps_lng          float8,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (shop_id, staff_id, date)
);

alter table attendances enable row level security;

create policy "オーナー全操作" on attendances
  for all using (
    shop_id in (
      select id from shops where organization_id in (
        select id from organizations where owner_user_id = auth.uid()
      )
    )
  );

create policy "本人の打刻操作" on attendances
  for all using (
    staff_id in (select id from staff where user_id = auth.uid())
  );

-- ────────────────────────────────────────────
-- salary_custom_items
-- ────────────────────────────────────────────
create table salary_custom_items (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  name         text not null,
  type         text not null
                 check (type in ('count_unit','fixed','percentage','expense','time_unit')),
  unit_price   integer,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table salary_custom_items enable row level security;

create policy "オーナー全操作" on salary_custom_items
  for all using (
    shop_id in (
      select id from shops where organization_id in (
        select id from organizations where owner_user_id = auth.uid()
      )
    )
  );

-- ────────────────────────────────────────────
-- salary_custom_records
-- ────────────────────────────────────────────
create table salary_custom_records (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  staff_id     uuid not null references staff(id) on delete cascade,
  item_id      uuid not null references salary_custom_items(id) on delete cascade,
  year_month   text not null,
  value        numeric not null,
  created_at   timestamptz not null default now(),
  unique (staff_id, item_id, year_month)
);

alter table salary_custom_records enable row level security;

create policy "オーナー全操作" on salary_custom_records
  for all using (
    shop_id in (
      select id from shops where organization_id in (
        select id from organizations where owner_user_id = auth.uid()
      )
    )
  );

create policy "本人参照" on salary_custom_records
  for select using (
    staff_id in (select id from staff where user_id = auth.uid())
  );

-- ────────────────────────────────────────────
-- updated_at 自動更新トリガー
-- ────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger attendances_updated_at
  before update on attendances
  for each row execute function update_updated_at();

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();

-- ────────────────────────────────────────────
-- service_role GRANT
-- ────────────────────────────────────────────
grant all on organizations to service_role;
grant all on subscriptions to service_role;
grant all on shops to service_role;
grant all on staff to service_role;
grant all on shop_staff to service_role;
grant all on shifts to service_role;
grant all on attendances to service_role;
grant all on salary_custom_items to service_role;
grant all on salary_custom_records to service_role;

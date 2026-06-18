# データベース設計

最終更新: 2026-06-18

Supabase (PostgreSQL) を使用。RLS を全テーブルに適用。

---

## ER 概要

```
organizations ──< shops ──< shop_staff >── staff ──< attendances
                       └──< shifts              └──< salary_custom_records
                       └──< salary_custom_items

organizations ──< subscriptions
staff ──< salary_settings（時給・交通費・アラート閾値）
```

---

## テーブル定義

### organizations

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | 会社・屋号名 |
| owner_user_id | uuid NOT NULL | auth.users FK |
| created_at | timestamptz DEFAULT now() | |

RLS: owner_user_id = auth.uid() のみ読み書き可

---

### shops

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid NOT NULL FK | organizations.id |
| name | text NOT NULL | 店舗名 |
| timezone | text NOT NULL DEFAULT 'Asia/Tokyo' | |
| punch_modes | text[] NOT NULL DEFAULT '{tablet,smartphone}' | 有効な打刻方式 |
| gps_lat | float8 | 店舗緯度 |
| gps_lng | float8 | 店舗経度 |
| gps_radius_m | integer DEFAULT 300 | GPS許可半径（m） |
| gps_enabled | boolean DEFAULT true | 個人スマホGPS確認ON/OFF |
| created_at | timestamptz DEFAULT now() | |

---

### staff

organizationに紐づく従業員マスタ。複数店舗に所属可能。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid NOT NULL FK | organizations.id |
| user_id | uuid FK | auth.users（招待承諾後に紐づく） |
| name | text NOT NULL | |
| gender | text | male / female / other。賃金台帳の法定記載事項（労基法108条） |
| email | text | 招待メール送信先 |
| pin | text | タブレット打刻用4桁PIN（bcryptハッシュ） |
| income_alert_amount | integer | 年収アラート閾値（円）。NULLで無効 |
| created_at | timestamptz DEFAULT now() | |

---

### shop_staff

スタッフと店舗の所属関係 + 店舗別給与設定。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| shop_id | uuid NOT NULL FK | shops.id |
| staff_id | uuid NOT NULL FK | staff.id |
| role | text NOT NULL DEFAULT 'staff' | staff / manager |
| hourly_rate | integer NOT NULL | 時給（円） |
| transport_fee | integer DEFAULT 0 | 交通費（円） |
| transport_fee_type | text DEFAULT 'daily' | daily / monthly |
| is_active | boolean DEFAULT true | |
| created_at | timestamptz DEFAULT now() | |

UNIQUE (shop_id, staff_id)

---

### shifts

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| shop_id | uuid NOT NULL FK | shops.id |
| staff_id | uuid NOT NULL FK | staff.id |
| starts_at | timestamptz NOT NULL | |
| ends_at | timestamptz NOT NULL | |
| break_minutes | integer DEFAULT 0 | |
| note | text | |
| created_by | uuid FK | auth.users |
| created_at | timestamptz DEFAULT now() | |

---

### attendances

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| shop_id | uuid NOT NULL FK | shops.id |
| staff_id | uuid NOT NULL FK | staff.id |
| date | date NOT NULL | 出勤日 |
| clocked_in_at | timestamptz | 出勤打刻 |
| clocked_out_at | timestamptz | 退勤打刻 |
| break_minutes | integer DEFAULT 0 | |
| punch_mode | text | tablet / smartphone |
| gps_lat | float8 | 打刻時GPS緯度（記録用） |
| gps_lng | float8 | 打刻時GPS経度（記録用） |
| note | text | 管理者メモ・修正理由 |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

UNIQUE (shop_id, staff_id, date)

---

### salary_custom_items

店舗ごとに定義するカスタム給与項目テンプレート。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| shop_id | uuid NOT NULL FK | shops.id |
| name | text NOT NULL | 表示名（自由に変更可） |
| type | text NOT NULL | count_unit / fixed / percentage / expense / time_unit |
| unit_price | integer | 単価（count_unit/time_unit のとき使用） |
| sort_order | integer DEFAULT 0 | |
| created_at | timestamptz DEFAULT now() | |

type の意味：
- count_unit: 件数×単価（ドリンクカウント等）
- fixed: 固定額（皆勤手当等）
- percentage: 売上×歩合率
- expense: 実費入力（立替等）
- time_unit: 時間数×単価

---

### salary_custom_records

カスタム給与項目の月次実績。

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| shop_id | uuid NOT NULL FK | shops.id |
| staff_id | uuid NOT NULL FK | staff.id |
| item_id | uuid NOT NULL FK | salary_custom_items.id |
| year_month | text NOT NULL | 'YYYY-MM' 形式 |
| value | numeric NOT NULL | 件数 or 金額 or 売上額 |
| created_at | timestamptz DEFAULT now() | |

UNIQUE (staff_id, item_id, year_month)

---

### subscriptions

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid NOT NULL FK | organizations.id |
| stripe_customer_id | text | |
| stripe_subscription_id | text | |
| status | text | active / trialing / canceled / past_due |
| seat_count | integer DEFAULT 0 | 契約シート数 |
| current_period_end | timestamptz | |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

---

## 給与計算ロジック（DB外・アプリ層で計算）

1. attendances から実労働時間を計算（clocked_out_at - clocked_in_at - break_minutes）
2. 22:00〜翌5:00 の重複時間に × 1.25 を適用
3. shop_staff.transport_fee × 出勤日数（daily の場合）を加算
4. salary_custom_records の value を item.type に応じて金額換算して加算
5. 合計 = 基本給 + 深夜割増 + 交通費 + カスタム項目合計

---

## RLS 方針

- オーナー：自分の organization 配下の全データを読み書き
- マネージャー：自分が所属する shop のデータのみ
- スタッフ：自分の attendances・shifts・salary 明細のみ読み取り
- 未認証：アクセス不可（全テーブル）

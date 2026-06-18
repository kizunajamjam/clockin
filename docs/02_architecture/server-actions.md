# Server Actions

最終更新: 2026-06-18

全て `'use server'` で定義。戻り値は `{ error: string } | null`（エラー時）または `redirect()`（成功時）。

---

## 認証

### `src/app/signup/actions.ts`

#### `signUp(prevState, formData)`
| フィールド | バリデーション |
|---|---|
| organization_name | 必須 |
| email | 必須 |
| password | 必須・8文字以上 |

1. `supabase.auth.signUp()` でユーザー作成
2. admin client で `organizations` レコードを作成
3. `/dashboard` へリダイレクト

---

### `src/app/login/actions.ts`

#### `login(prevState, formData)`
| フィールド | バリデーション |
|---|---|
| email | 必須 |
| password | 必須 |

1. `signInWithPassword()` で認証
2. `/dashboard` へリダイレクト

---

### `src/app/logout/actions.ts`

#### `logout()`
1. `supabase.auth.signOut()`
2. `/login` へリダイレクト

---

## 店舗

### `src/app/(protected)/shops/new/actions.ts`

#### `createShop(prevState, formData)`
| フィールド | バリデーション |
|---|---|
| name | 必須 |
| punch_modes | 1つ以上選択 |
| gps_enabled | boolean |
| gps_radius_m | 50〜1000（整数） |
| gps_lat / gps_lng | GPS ON + スマホ打刻の場合は必須 |

1. ログインユーザーの `organization_id` を取得
2. `shops` レコードを作成
3. `/shops/[id]` へリダイレクト

---

## スタッフ

### `src/app/(protected)/shops/[shopId]/staff/new/actions.ts`

#### `createStaff(prevState, formData)`
| フィールド | バリデーション |
|---|---|
| shop_id | 必須・オーナー所有確認 |
| name | 必須 |
| hourly_rate | 必須・0以上の整数 |
| transport_fee | 任意（デフォルト0） |
| transport_fee_type | daily / monthly |
| night_rate_included | boolean |
| pin | タブレット打刻有効時は必須・4桁数字 |
| gender | 任意（male/female/other） |
| income_alert_amount | 任意・整数（円） |

1. フリープラン5名上限チェック
2. `crypto.randomUUID()` でstaffId生成
3. PINをPBKDF2でハッシュ化（saltはstaffId）
4. `staff` → `shop_staff` の順に挿入
5. `/shops/[shopId]` へリダイレクト

---

## 打刻（タブレットキオスク）

### `src/app/kiosk/[shopId]/actions.ts`

#### `punchTablet(formData)` — 認証不要（公開エンドポイント）
| フィールド | バリデーション |
|---|---|
| staff_id | 必須 |
| shop_id | 必須 |
| pin | 必須・4桁数字 |

1. スタッフのPINハッシュを取得してPBKDF2で検証
2. 当日の `attendances` レコードを確認
   - 未打刻 → 出勤打刻（`clocked_in_at`）
   - 出勤済み・未退勤 → 退勤打刻（`clocked_out_at`）
   - 両方済み → エラー（本日分完了）
3. `{ success: true, type: 'in'|'out', staffName }` を返す

---

## 今後追加予定

| アクション | 場所 | 概要 |
|---|---|---|
| `clockInSmartphone` | `/punch` | 個人スマホ打刻（GPS確認含む） |
| `updateAttendance` | `/shops/[shopId]/attendance` | 打刻修正（修正理由必須） |
| `createShift` | `/shops/[shopId]/shifts` | シフト作成（プロ限定） |
| `createStripeSession` | `/settings/billing` | Stripe Checkout セッション作成 |

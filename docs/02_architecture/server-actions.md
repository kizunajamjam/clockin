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

## 今後追加予定

| アクション | 場所 | 概要 |
|---|---|---|
| `createStaff` | `/shops/[shopId]/staff/new` | スタッフ登録・招待 |
| `clockIn` | `/punch` | 出勤打刻（GPS確認含む） |
| `clockOut` | `/punch` | 退勤打刻 |
| `updateAttendance` | `/shops/[shopId]/attendance` | 打刻修正（修正理由必須） |
| `createShift` | `/shops/[shopId]/shifts` | シフト作成（プロ限定） |
| `createStripeSession` | `/settings/billing` | Stripe Checkout セッション作成 |

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
3. `/dashboard` へリダイレクト（スタッフアカウントは `/punch` へ）

---

### `src/app/login/actions.ts`

#### `login(prevState, formData)`
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
| prefecture | 必須 |
| punch_modes | 1つ以上選択 |
| gps_enabled | boolean |
| gps_radius_m | 50〜1000（整数） |
| gps_lat / gps_lng | GPS ON + スマホ打刻の場合は必須 |

1. ログインユーザーの `organization_id` を取得
2. `shops` レコードを作成
3. `/shops/[id]` へリダイレクト

---

### `src/app/(protected)/shops/[shopId]/settings/actions.ts`

#### `updateShop(prevState, formData)`
createShop と同フィールド + `shop_id`。オーナー権限確認後に `shops` レコードを更新。

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
2. `crypto.randomUUID()` でstaffId・invite_tokenを生成
3. PINをPBKDF2でハッシュ化（saltはstaffId）
4. `staff` → `shop_staff` の順に挿入
5. `/shops/[shopId]` へリダイレクト

---

### `src/app/(protected)/shops/[shopId]/staff/[staffId]/actions.ts`

#### `updateStaff(prevState, formData)`
createStaff と同フィールド + `staff_id` / `is_active`。PIN は空欄なら変更なし。オーナー権限確認後に `staff` と `shop_staff` を更新。

---

## スタッフ招待

### `src/app/invite/[token]/actions.ts`

#### `acceptInvite(prevState, formData)`
| フィールド | バリデーション |
|---|---|
| token | 必須・招待トークン（URL由来） |
| email | 必須 |
| password | 必須・8文字以上 |

1. `invite_token` でstaffレコードを検索
2. `user_id` 設定済みならエラー（既使用）
3. `admin.auth.admin.createUser()` でSupabase Authアカウント作成
4. staffレコードに `user_id` / `email` を紐付け、`invite_token` を null にクリア
5. `/punch/setup-complete` へリダイレクト

---

## 打刻

### `src/app/kiosk/[shopId]/actions.ts`

#### `getAttendanceStatus(staffId, shopId)` — 認証不要
当日の `attendances` レコードを確認し `'in' | 'out' | 'done'` を返す。キオスクのPIN画面で出退勤種別を事前表示するために使用。

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

### `src/app/punch/actions.ts`

#### `punchSmartphone(formData)` — ログイン必須
| フィールド | バリデーション |
|---|---|
| shop_id | 必須 |
| gps_lat / gps_lng | GPS有効時は必須（クライアントが取得してsubmit） |

1. ログインユーザーの `staff.id` を取得
2. 店舗のスマホ打刻有効 + 所属確認
3. GPS有効時: Haversine公式で店舗座標との距離を計算 → 半径外はエラー
4. 当日のattendanceレコード確認（タブレット打刻と同じロジック）
5. `{ success: true, type: 'in'|'out', shopName }` を返す

---

## 勤怠修正

### `src/app/(protected)/shops/[shopId]/attendance/actions.ts`

#### `correctAttendance(prevState, formData)`
| フィールド | バリデーション |
|---|---|
| attendance_id | 必須 |
| shop_id | 必須 |
| clocked_in_at | datetime-local |
| clocked_out_at | datetime-local（任意） |
| note | 必須（修正理由） |

オーナー権限確認後に `attendances` を更新。修正理由は `note` カラムに記録。

---

## プロフィール

### `src/app/(protected)/profile/actions.ts`

#### `updateProfile(prevState, formData)`
ログインユーザーに紐付く `staff.income_alert_amount` を更新。

---

## Stripe

### `src/app/api/stripe/checkout/route.ts` (POST)
`{ interval: 'month'|'year', seatCount: number }` を受け取り、Stripe Checkout セッションを作成してURLを返す。Stripeカスタマーが未作成の場合は自動作成。

### `src/app/api/stripe/webhook/route.ts` (POST)
Stripeからのwebhookを処理。対象イベント:
- `checkout.session.completed` → `subscriptions` レコードをupsert
- `customer.subscription.updated` → status / seat_count / current_period_end を更新
- `customer.subscription.deleted` → status を canceled に更新

---

## 今後追加予定

| アクション | 場所 | 概要 |
|---|---|---|
| `createShift` | `/shops/[shopId]/shifts` | シフト作成（プロ限定） |
| `notifyIncomeAlert` | バックグラウンド | 年収アラート通知（累計給与が閾値到達時） |
| `calcDeductions` | `/shops/[shopId]/payroll` | 控除計算（所得税・雇用保険）※下記参照 |

### 控除計算（今後実装予定）

MVP では支給額のみ表示。将来的に以下を追加予定：

| 項目 | 難易度 | 備考 |
|---|---|---|
| 雇用保険 | 低 | 料率固定（現行0.6%）。週20時間以上で適用 |
| 所得税（源泉徴収） | 中 | 国税庁「月額表」を実装。扶養人数により変動。毎年改定要 |
| 住民税 | 低〜中 | パートは普通徴収が多いため任意実装 |
| 健康保険・厚生年金 | 高 | 週30時間未満のパートは原則適用外。小規模店舗では不要なケースが多い |

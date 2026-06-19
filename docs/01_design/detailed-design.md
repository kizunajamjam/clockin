# 詳細設計書

最終更新: 2026-06-19
対象システム: clockin（日本国内専用）

[基本設計書](basic-design.md)を受け、主要処理のロジック・I/F・データ操作・状態遷移を定義する。
DBスキーマの正は [database.md](../02_architecture/database.md)、Server Action 全体像は
[server-actions.md](../02_architecture/server-actions.md) を参照。

---

## 1. 共通設計

### 1.1 ディレクトリ構成（抜粋）
```
src/
  middleware.ts                      認証ガード入口
  lib/
    supabase/{server,client,admin,middleware}.ts  各Supabaseクライアント
    pin.ts        PINハッシュ/検証（PBKDF2 / Web Crypto）
    payroll.ts    給与計算ロジック（純関数）
    minWage.ts    都道府県別最低賃金チェック
    push.ts       Web Push 送信ユーティリティ
    stripe.ts     Stripeクライアント・価格ID
  app/
    (protected)/  オーナー向け（認証必須レイアウト）
    punch/        スタッフ向け（下部ナビ付きレイアウト）
    kiosk/[shopId]/  共有端末打刻（未認証）
    invite/[token]/  招待受諾
    api/{stripe,push}/  Route Handlers
  components/{AdBanner,PushPermission}.tsx
public/sw.js      Service Worker（push / notificationclick）
```

### 1.2 Supabase クライアントの使い分け

| クライアント | 生成 | 用途 | RLS |
|---|---|---|---|
| server | `createClient()`（@supabase/ssr） | ログインユーザーの本人確認（`auth.getUser()`） | 有効 |
| admin | `createAdminClient()`（service_role） | データCRUD全般 | **迂回** |
| middleware | `updateSession()` | Cookieセッション更新・認証ガード | 有効 |

**設計規約**: admin クライアントで更新/取得する処理は、対象リソースの所有者/所属を必ず照合する。
この検証は共通モジュール [src/lib/auth.ts](../../src/lib/auth.ts) のヘルパに集約する（検証漏れ防止）:

| ヘルパ | 検証内容 | 戻り値 |
|---|---|---|
| `getAuthedStaff()` | ログイン + `staff` 存在 | `{ userId, staffId, admin } \| null` |
| `getAuthedStaffForShop(shopId)` | 上記 + `shop_staff` アクティブ所属 | 同上 |
| `getOwnerShop(shopId)` | ログイン + 組織所有者による店舗所有 | `{ userId, shop, admin } \| null` |

スタッフ系（punch/punch shifts/push）・オーナー系（owner shifts）アクションは全て本ヘルパ経由。
新規 service_role アクションも必ずこのヘルパで認可すること。

**書き込みスコープ必須ルール（重要）**: 所有者検証を通した後でも、**更新/削除の対象行は
`id` 単独で指定してはならない**。必ず検証済みの `shop_id` / `organization_id` を併記して
テナント境界に閉じること（例: `.eq('id', x).eq('shop_id', verifiedShopId)`）。
これを怠ると別テナントの行を改ざんできる（第2回監査の R-1/R-3/R-4 が実例）。
参照: [review §5](../04_review/review-2026-06-19.md)。

### 1.3 日付・時刻の取り扱い（JST固定）
- 「今日」: `new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })` → `YYYY-MM-DD`。
- 表示時刻: `toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', ... })`。
- 打刻時刻の保存: `new Date().toISOString()`（UTC、timestamptz）。
- 週境界の算出: JSTの当日から曜日を求め、月曜/日曜始まりに合わせてオフセット
  （サーバーTZに依存させない。詳細は §4.1）。

---

## 2. 打刻機能

### 2.1 複数回打刻のデータモデル
- `attendances` は「1出勤=1レコード」。出勤で行を作成、退勤で同行を更新。
- 同日複数回（中抜け・連勤）に対応するため `UNIQUE(shop_id,staff_id,date)` を撤廃し、
  部分ユニークインデックスで「未退勤（`clocked_out_at IS NULL`）は同日1件まで」を担保。

### 2.2 出退勤の自動判定アルゴリズム（キオスク/スマホ共通）
```
今日(JST)の (shop_id, staff_id) で clocked_out_at IS NULL のレコードを1件検索
  ├─ あり → そのレコードを退勤更新（clocked_out_at = now）→ type='out'
  └─ なし → 新規レコード挿入（clocked_in_at = now）       → type='in'
```
実装: [kiosk/[shopId]/actions.ts](../../src/app/kiosk/[shopId]/actions.ts) `punchTablet` /
[punch/actions.ts](../../src/app/punch/actions.ts) `punchSmartphone`。
`getAttendanceStatus` も同ロジックで次回打刻種別（in/out）を返す。

### 2.3 キオスク打刻（PIN方式）
入力: `{ staff_id, shop_id, pin(4桁) }`
1. 入力バリデーション（`/^\d{4,6}$/`）＋ IP単位スロットリング確認。
2. `staff` から `pin`（PBKDF2ハッシュ）取得。`verifyPin(pin, staff.id, hash)` で照合。
3. §2.2 の判定で出勤/退勤。`punch_mode='tablet'`。
4. 戻り値: `{ success, type, staffName } | { success:false, error }`。

**PINロックアウト（ブルートフォース対策 / S-2対応済み）**:
```
staff.pin_locked_until が未来 → 検証せず拒否（残り分数を表示）
PIN照合:
  失敗 → pin_failed_count += 1（ロック期限切れ時は0起算）
         5回到達で pin_locked_until = now + 5分、以降ロック
  成功 → pin_failed_count = 0, pin_locked_until = null
```
定数: `MAX_PIN_ATTEMPTS=5` / `PIN_LOCK_MINUTES=5`。staff単位（PINはstaff固有）。
Edge環境ではインメモリ状態を持てないため状態はDB（staff行）で管理する。

**PINハッシュ（[src/lib/pin.ts](../../src/lib/pin.ts)）**: PBKDF2-SHA256 / salt=staff.id。
保存形式は前方互換 `v2$<iterations>$<hex>`（新規10万回）。旧形式（`$`なし=1万回）も検証可能で、
打刻成功時に `needsRehash()` が true なら現行パラメータへ透過的に再ハッシュして昇格。
ハッシュ比較は定数時間（タイミング攻撃対策）。

**PIN桁数**: 4〜6桁の可変（`/^\d{4,6}$/`）。スタッフ作成/編集で任意の長さを設定でき、
キオスクUIは入力に応じて4〜6マスを表示、4桁以上で送信可能。桁数はハッシュに含まれるため
列追加は不要（検証時は入力PINをハッシュして比較）。

**IP単位スロットリング＋監査ログ**: `punch_attempts`（[migration 20260619000001](../../supabase/migrations/20260619000001_punch_attempts.sql)）に
全打刻試行（成功/失敗・staff_id・IP）を記録。同一IPからの失敗が `IP_WINDOW_MINUTES=10` 分間に
`IP_MAX_FAILS=20` 件でブロック（staff横断の総当たり対策。staff単位ロックアウトと二段構え）。
IPは `cf-connecting-ip` → `x-forwarded-for` の順で取得。全て無料枠（DBのみ）で完結。

### 2.4 スマホ打刻（GPS方式）
入力: `{ shop_id, gps_lat?, gps_lng? }`（ログイン必須）
1. `auth.getUser()` → `staff(user_id)` 解決。
2. 店舗の `punch_modes` に `smartphone` が含まれるか確認。
3. `shop_staff` で `(shop_id, staff_id, is_active)` の所属確認。
4. `gps_enabled` の場合、Haversine距離が `gps_radius_m` 以内か検証（座標未取得は失敗）。
5. §2.2 の判定で出勤/退勤。`punch_mode='smartphone'`、打刻座標を記録。

Haversine: 地球半径 6,371,000m。距離 > 許可半径 で打刻拒否。

---

## 3. 給与計算（[src/lib/payroll.ts](../../src/lib/payroll.ts)）

純関数として実装（DB非依存・テスト容易）。入力は `AttendanceRecord[]` と `ShopStaffSetting`。

### 3.1 日次計算 `calcDailyPayroll`
```
出勤/退勤いずれか欠落 → null（未計上）
実働分 = floor((out - in)/60000) - break_minutes ; <=0 なら null
深夜分 = night_rate_included ? 0 : minutesInNight(in, out)   // 1分刻みで22:00-翌5:00を判定
通常分 = 実働分 - 深夜分
基本給   = floor(時給/60 * 通常分)
深夜割増 = night_rate_included ? 0 : floor(時給/60 * 深夜分 * 1.25)   // 労基法37条 25%
交通費   = transport_fee_type=='daily' ? transport_fee : 0
日合計   = 基本給 + 深夜割増 + 交通費
```

### 3.2 月次集計 `calcMonthlyPayroll`
```
days = records.map(calcDailyPayroll).filter(非null)
# 日払い交通費は「日付」単位で1回のみ（同日複数打刻の二重計上防止）
if transport_fee_type == 'daily':
    seen = Set()
    for d in days:
        if d.date in seen: d.total -= d.transport_fee; d.transport_fee = 0
        else: seen.add(d.date)
work_days        = distinct(days.date) 件数
total_*          = days の各項目合計
total_transport  = Σ d.transport_fee + (monthly のとき transport_fee を1回)
grand_total      = 基本給 + 深夜割増 + 交通費
```
**設計判断**: 深夜割増・基本給は「打刻スパン単位」で正しく加算されるため複数打刻でも
合算で正しい。交通費（日払い）と出勤日数のみ「日付単位」での集約が必要だった
（[レビュー F-1/F-2](../04_review/review-2026-06-19.md) で修正）。

### 3.3 出力先
- オーナー: 店舗全員サマリ `/shops/[id]/payroll`、個人明細＋CSV `/shops/[id]/payroll/[staffId]`。
- スタッフ: 自分の月次明細 `/punch/payroll`（店舗切替・前月/翌月ナビ）。
- CSV: BOM付きUTF-8、行=日別、末尾に合計行。

### 3.4 年収アラート
スタッフ給与画面で、当年1月〜対象月末の累計支給が `staff.income_alert_amount` 以上のとき
amberバナーを表示（[punch/payroll/page.tsx](../../src/app/punch/payroll/page.tsx)）。閾値はスタッフが任意設定。

---

## 4. シフト管理

### 4.1 取得範囲の算出（オーナー [shifts/page.tsx](../../src/app/(protected)/shops/[shopId]/shifts/page.tsx)）
```
todayJst = 今日(Asia/Tokyo, YYYY-MM-DD)
anchor   = Date(`${todayJst}T00:00:00Z`)            # 曜日計算用UTCアンカー
anchor  -= ((anchor.UTCDay + 6) % 7) + 1 日          # 直近の日曜（日曜始まり店舗も取りこぼさない）
weekStartStr = anchor (YYYY-MM-DD)
rangeEndStr  = weekStartStr + 30日
shifts:         starts_at ∈ [weekStartStr T00:00+09:00, rangeEndStr T00:00+09:00]
shift_requests: date      ∈ [weekStartStr, rangeEndStr]
```
表示の週始め（月/日）は `shops.week_start` をクライアントへ渡し、列順・曜日見出しを切替。

### 4.2 シフトカレンダー（[ShiftCalendar.tsx](../../src/app/(protected)/shops/[shopId]/shifts/ShiftCalendar.tsx)）
- ビュー: 週 / 2週 / 月（`localStorage('shift-view-<shopId>')` に保持）。
- グリッド: 行=スタッフ、列=日付。各セルに確定シフト（青）と希望シフト
  （pending=琥珀 / approved=緑 / rejected=取消線）をバッジ表示。
- 予定人件費: `calcShiftCost`（クライアント側、15分刻みで深夜割増を近似）で
  日別・期間合計を表示。※確定給与計算（payroll.ts, 1分刻み）とは別物・近似である点に注意。
- スタッフ名クリックで `StaffShiftEditor` に遷移し、複数日チェック→一括登録、
  曜日一括選択、希望シフトの承認/却下を行う。

### 4.3 シフト登録 `createShift`（オーナー専用 / [shifts/actions.ts](../../src/app/(protected)/shops/[shopId]/shifts/actions.ts)）
入力: `{ shop_id, staff_id, date, starts_at(HH:mm), ends_at(HH:mm), break_minutes, note }`
1. 必須チェック。
2. 終了 ≤ 開始 なら終了日を翌日扱い（`+09:00` 付きISOで保存、日跨ぎ対応）。
3. `getOwnerShop(shopId)` でオーナー所有を検証（未所有なら拒否）。
4. `shifts` に insert（`created_by=userId`）。

### 4.4 希望シフト
- 提出 `upsertShiftRequest`（スタッフ / [punch/shifts/actions.ts](../../src/app/punch/shifts/actions.ts)）:
  `auth.getUser()` → staff 解決 → **`shop_staff` 所属検証**（[レビュー S-1 修正](../04_review/review-2026-06-19.md)）
  → `shift_requests` upsert（`onConflict: shop_id,staff_id,date`、status='pending'）。
- 取消 `deleteShiftRequest`: `.eq('staff_id', staff.id)` でスコープし本人分のみ削除。
- 承認/却下 `updateShiftRequestStatus`（オーナー）: `getOwnerShop` 検証後、
  status を `approved|rejected|pending` のいずれかに更新（値はホワイトリスト検証）。
  承認/却下時はスタッフへプッシュ通知（§6.3）。
- 確定反映 `createShiftFromRequest`（オーナー）: 承認済み希望（`start_time`/`end_time` 必須）を
  `shifts` に1件作成し、希望を `approved` に確定、スタッフへ「シフトが確定しました」通知。
  時刻未指定の希望は反映不可（エラー返却）。UIは [ShiftCalendar.tsx](../../src/app/(protected)/shops/[shopId]/shifts/ShiftCalendar.tsx)
  の希望一覧に「シフトに反映」ボタンとして表示（同一セッション内の二重反映は `reflected` セットで抑止）。

### 4.5 希望シフトの状態遷移
```
(提出) → pending ──承認──> approved
                  └─却下──> rejected
pending は本人が取消可。approved/rejected はオーナー操作のみ（再変更可）。
```

---

## 5. 課金（Stripe）

### 5.1 Checkout 作成（[api/stripe/checkout/route.ts](../../src/app/api/stripe/checkout/route.ts)）
入力: `{ interval: 'month'|'year', seatCount }`（オーナー認証必須）
1. `organizations(owner_user_id)` 解決。
2. 既存 `subscriptions.stripe_customer_id` を再利用、なければ Stripe Customer 作成
   （`metadata.organization_id` 付与）。
3. `checkout.sessions.create`（price=月/年, quantity=seatCount,
   session/subscription 双方の `metadata.organization_id` 付与）→ URL返却。

### 5.2 Webhook（[api/stripe/webhook/route.ts](../../src/app/api/stripe/webhook/route.ts)）
1. `stripe-signature` を `constructEvent` で検証（不正は400）。
2. `checkout.session.completed`: サブスク取得 → `subscriptions` upsert
   （`onConflict: organization_id`、status/seat/期末を反映）。
3. `customer.subscription.updated|deleted`: `metadata.organization_id` で
   `subscriptions` を update（status/seat/期末）。

### 5.3 プロ判定
`subscriptions.status ∈ {active, trialing}` を「プロ」とみなす。
ダッシュボード表示・給与画面ガード（フリーは 🔒 表示）で使用。

---

## 6. 通知（Web Push）

### 6.1 購読登録（[components/PushPermission.tsx](../../src/components/PushPermission.tsx) → [api/push/subscribe/route.ts](../../src/app/api/push/subscribe/route.ts)）
1. クライアントで権限要求 → `serviceWorker.register('/sw.js')` → `pushManager.subscribe`
   （`applicationServerKey = NEXT_PUBLIC_VAPID_PUBLIC_KEY`）。
2. `{ endpoint, p256dh, auth }` を POST。
3. API は認証確認 → `staff(user_id)` 解決 → `push_subscriptions` upsert
   （`onConflict: staff_id,endpoint`）。DELETE で購読解除。

### 6.2 送信（[lib/push.ts](../../src/lib/push.ts)）
- `sendPushToStaff(staffId, payload)`: 当該スタッフの全購読へ並列送信。
- VAPID鍵未設定時はスキップ（警告ログのみ）。
- Service Worker（[public/sw.js](../../public/sw.js)）が `push` で通知表示、
  `notificationclick` で `data.url`（既定 `/punch`）を開く。

### 6.3 送信トリガー（実装済み）
| 契機 | 実装 | 文言 |
|---|---|---|
| 希望シフト承認 | `updateShiftRequestStatus(status='approved')` | 「希望シフトが承認されました」 |
| 希望シフト却下 | `updateShiftRequestStatus(status='rejected')` | 「希望シフトが却下されました」 |
| シフト確定反映 | `createShiftFromRequest` | 「シフトが確定しました」 |
- いずれも `sendPushToStaff(staff_id, …)` を呼ぶ。VAPID未設定時は自動スキップ。
- **手動の一括シフト登録（`createShift` のN日ループ）では通知しない**（通知スパム回避の設計判断）。

---

## 7. 認可マトリクス（実装レベル）

| 操作 | チェック内容 | 実装箇所 |
|---|---|---|
| オーナーの店舗操作 | `organizations.owner_user_id = uid` かつ `shop.organization_id` 一致 | `getOwnerShop` / 各page |
| スタッフの打刻 | `staff.user_id = uid` + `shop_staff` 所属 + GPS | `punchSmartphone` |
| 希望シフト提出 | `staff.user_id = uid` + `shop_staff` 所属 | `upsertShiftRequest` |
| 希望シフト取消 | `staff_id = 本人` | `deleteShiftRequest` |
| 希望シフト承認 | オーナー所有店舗 | `updateShiftRequestStatus` |
| Push購読 | `staff.user_id = uid` | `/api/push/subscribe` |
| Checkout/Webhook | オーナー認証 / 署名検証 | `/api/stripe/*` |
| キオスク打刻 | PIN照合のみ（認証なし） | `punchTablet` |

---

## 8. エラーハンドリング方針
- Server Action は例外を投げず `{ error: string }` を返し、クライアントで表示。
- 認可失敗は具体情報を出さない汎用メッセージ（「権限がありません」等）。
- Webhook/署名失敗は 4xx を返し Stripe にリトライさせる（成功時のみ 200）。
- Push送信失敗は握りつぶしてログのみ（ユーザー操作をブロックしない）。

---

## 9. 既知の技術的負債（詳細設計観点）
- ~~キオスクPINのレート制限~~ → PINロックアウト実装済み（S-2）。追加強化（IP制限/監査ログ/6桁化）は任意。
- ~~service_role 依存で認可漏れリスク~~ → `src/lib/auth.ts` に認可ヘルパ集約済み（S-3）。新規アクションも経由必須。
- 予定人件費（クライアント近似）と確定給与（payroll.ts）で深夜割増の刻みが異なる。
- スタッフ側 payroll/shifts の範囲算出が一部サーバーTZ依存（影響軽微・F-6）。
- `attendances.date` カラムは複数打刻時代において役割を再整理する余地あり
  （[roadmap 技術的負債](../03_development/roadmap.md)）。

# 実装ログ

最終更新: 2026-06-18

このドキュメントはセッションをまたいで積み上がる実装記録。
「何をなぜやったか」を残し、同じ問題を二度調査しないようにする。

---

## DB マイグレーション一覧

| ファイル | 内容 | 適用済み |
|---|---|---|
| `20260618000000_initial_schema.sql` | 初期スキーマ全体 | ✅ |
| `20260618000001_invite_token.sql` | スタッフ招待トークン | ✅ |
| `20260618000002_shop_prefecture.sql` | 店舗に都道府県カラム追加 | ✅ |
| `20260618000003_subscriptions_unique_push.sql` | subscriptions に UNIQUE(organization_id) 追加 + push_subscriptions テーブル | ✅ |
| `20260618000004_multi_punch_per_day.sql` | attendances の UNIQUE 制約を削除し、部分ユニークインデックス（WHERE clocked_out_at IS NULL）へ変更 | ✅ |
| `20260618000005_shop_week_start.sql` | shops に week_start カラム（'mon'/'sun'、DEFAULT 'mon'）追加 | ✅ |
| `20260618000006_shift_requests.sql` | shift_requests テーブル + RLS（スタッフ自身のみ操作可） | ✅ |
| `20260618000007_shift_requests_owner_policy.sql` | shift_requests にオーナー向け SELECT/UPDATE ポリシー追加 | ✅ |

---

## 実装済み機能

### ダッシュボード

- プロプラン判定を動的化（旧: ハードコード "フリー"）
- `subscriptions` テーブルを参照し `status === 'active' || 'trialing'` でプロ表示

### 打刻（punch / kiosk）

**1日複数回打刻対応**
- 旧: `attendances` に `UNIQUE(shop_id, staff_id, date)` → 1日1回しか打刻できなかった
- 新: UNIQUE 制約を廃止し、`WHERE clocked_out_at IS NULL` の部分ユニークインデックスへ
- ロジック: 「open レコード（clocked_out_at IS NULL）があれば退勤、なければ新規出勤」
- `PunchType` から `'done'` 状態を削除。打刻ボタンは常に有効

### プッシュ通知

- VAPID キー生成・`.env.local` に設定済み
- `PushPermission.tsx`: 権限リクエスト → service worker 登録 → push サブスクリプション → `/api/push/subscribe` に POST
- `public/sw.js`: push イベントで `showNotification`、クリックで `openWindow`
- `src/lib/push.ts`: `sendPushNotification()` / `sendPushToStaff()` ユーティリティ
- 打刻完了画面（PunchClient の result 表示後）に `PushPermission` を配置
- 注意: `urlBase64ToUint8Array` の戻り値は `ArrayBuffer`（`Uint8Array` だと TS エラー）

### AdSense（広告）

- `AdBanner.tsx`: `NEXT_PUBLIC_ADSENSE_CLIENT_ID` / `NEXT_PUBLIC_ADSENSE_SLOT_ID` 未設定時はグレーのプレースホルダー表示
- 打刻完了画面に配置（打刻ボタンへの誤タップが起きないタイミング）
- **未設定**: 実際の publisher ID は AdSense 審査後に設定

### シフト管理（管理者）

**UX 刷新**
- 旧: datetime-local で日付・時刻を一体入力（日付不要なのに表示されていた）
- 新: 時刻のみ入力（HH:mm）、終了が開始より早い場合は翌日扱い

**ビューモード**
- 週 / 2週 / 月 の3種類を localStorage に保存（ショップID単位）

**週開始曜日**
- 店舗設定画面でオーナーのみ「月曜始まり / 日曜始まり」を設定
- `shops.week_start` カラム（'mon'/'sun'）に永続化
- シフトカレンダーに prop で渡して列計算を切り替え

**スタッフ別入力画面**
- 一覧グリッドでスタッフ名をクリック → `StaffShiftEditor` に遷移
- 時刻入力 → 複数日をチェックして一括登録
- 曜日ボタンで同じ曜日を一括チェック
- 日付は縦リスト（スマホ対応）

**予定人件費表示**
- `shop_staff.hourly_rate` と `night_rate_included` を取得
- `calcShiftCost()`: `night_rate_included` が true なら 22:00〜翌5:00 を 15 分刻みで分割し 1.25 倍計算
- カレンダーグリッドの最下行に日別人件費、ツールバー右端に期間合計を表示

### 希望シフト（スタッフ → 管理者）

**スタッフ側（`/punch/shifts`）**
- タブ切替: 「確定シフト」| 「希望を出す」
- `ShiftRequestClient.tsx`: 店舗選択 → 時刻任意指定 → 縦リストで日付チェック → 一括提出
- 既存リクエストのステータス表示（⏳確認中 / ✅承認 / ❌却下）
- 保留中のリクエストは「取消」ボタンで削除可能
- `upsertShiftRequest`: `UPSERT (onConflict: shop_id,staff_id,date)` で重複防止
- `deleteShiftRequest`: スタッフ本人のみ削除可

**管理者側（`/shops/[shopId]/shifts`）**
- 概要グリッドの各セルに希望シフトバッジ表示
  - 🟡 `? 希望`（pending）、🟢 `✓ 希望`（approved）、グレー `✕ 希望`（rejected）
  - hover で時刻・メモを tooltip 表示
- `StaffShiftEditor` 画面に「希望シフト」セクション追加
  - 承認・却下ボタン
  - `updateShiftRequestStatus` server action（オーナー権限チェック付き）
  - クライアント側で即座に状態更新（楽観的 UI）

### 年収アラート

- `staff.income_alert_amount` に任意金額をスタッフが設定
- `/punch/payroll`: 当年の累計支給額を集計し、`income_alert_amount` に達していたら amber バナーを表示

### setup-complete ページ移動

- 旧: `/punch/setup-complete` → `/punch/layout.tsx` のボトムナビが表示されてしまった
- 新: `/punch-complete/` に移動（punch ディレクトリ外なのでレイアウト非適用）
- `invite/[token]/actions.ts` の redirect 先を更新
- `src/lib/supabase/middleware.ts` の public パスも更新

---

## 発生した不具合と解決

| 問題 | 原因 | 解決 |
|---|---|---|
| subscriptions INSERT が `ON CONFLICT` エラー | `organization_id` に UNIQUE 制約がなかった | migration 000003 で UNIQUE 追加 |
| ダッシュボードがプロ契約後も「フリー」表示 | ハードコード | subscriptions テーブルを動的に参照するよう修正 |
| setup-complete にボトムナビが表示される | `/punch/layout.tsx` がサブルート全体に適用される | ページを `/punch-complete/` に移動 |
| `PushPermission` TypeScript エラー | `urlBase64ToUint8Array` の戻り値型が `Uint8Array<ArrayBufferLike>` | 戻り値を `ArrayBuffer` に明示 |
| `WEEKDAYS` が undefined エラー | リファクタ中にグローバル定数を削除、参照箇所が残った | `getWeekdays(weekStart)[colIdx]` に統一 |
| `web-push` npm install が競合 | peer deps 不整合 | `--legacy-peer-deps` で解決 |
| shift_requests RLS でオーナーが読めない | スタッフ自身ポリシーしかなかった | migration 000007 でオーナー向け SELECT/UPDATE ポリシー追加 |

---

## 環境変数（`.env.local`）

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=          # 本番設定時に追加

VAPID_PUBLIC_KEY=               # web-push 用（設定済み）
VAPID_PRIVATE_KEY=              # web-push 用（設定済み）
VAPID_EMAIL=                    # web-push 用（設定済み）
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # クライアントに公開（設定済み）

NEXT_PUBLIC_ADSENSE_CLIENT_ID=  # AdSense 審査後に設定
NEXT_PUBLIC_ADSENSE_SLOT_ID=    # AdSense 審査後に設定
```

---

## 主要ファイルマップ

```
src/
├── app/
│   ├── (protected)/
│   │   ├── dashboard/page.tsx              # プロプラン判定
│   │   └── shops/[shopId]/
│   │       ├── shifts/
│   │       │   ├── page.tsx                # シフト管理（Pro guard）
│   │       │   ├── ShiftCalendar.tsx       # カレンダーUI・人件費・希望承認
│   │       │   └── actions.ts              # createShift / deleteShift / updateShiftRequestStatus
│   │       ├── settings/
│   │       │   ├── page.tsx                # week_start 取得
│   │       │   ├── ShopSettingsForm.tsx    # week_start フィールド
│   │       │   └── actions.ts              # week_start 保存
│   │       ├── payroll/[staffId]/page.tsx  # 給与明細
│   │       └── attendance/page.tsx         # 勤怠記録
│   ├── punch/
│   │   ├── layout.tsx                      # ボトムナビ（4タブ）
│   │   ├── page.tsx                        # 打刻画面
│   │   ├── PunchClient.tsx                 # 打刻UI（AdBanner・PushPermission配置済み）
│   │   ├── shifts/
│   │   │   ├── page.tsx                    # 確定シフト | 希望を出す タブ
│   │   │   ├── ShiftRequestClient.tsx      # 希望シフト提出UI
│   │   │   └── actions.ts                  # upsertShiftRequest / deleteShiftRequest
│   │   └── payroll/page.tsx                # 給与明細（年収アラート）
│   ├── punch-complete/page.tsx             # 招待完了（ボトムナビなし）
│   ├── kiosk/[shopId]/
│   │   ├── page.tsx
│   │   ├── KioskClient.tsx                 # タブレット打刻UI
│   │   └── actions.ts                      # 1日複数打刻対応
│   ├── invite/[token]/
│   │   └── actions.ts                      # redirect → /punch-complete
│   └── api/push/subscribe/route.ts         # push サブスクリプション保存
├── components/
│   ├── AdBanner.tsx                        # AdSense バナー
│   └── PushPermission.tsx                  # プッシュ通知権限リクエスト
├── lib/
│   ├── push.ts                             # sendPushNotification / sendPushToStaff
│   └── supabase/
│       └── middleware.ts                   # /punch-complete をパブリックパスに追加
public/
└── sw.js                                   # Service Worker（push 受信・通知クリック）
```

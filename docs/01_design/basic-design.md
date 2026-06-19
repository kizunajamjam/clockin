# 基本設計書

最終更新: 2026-06-19
対象システム: clockin（小規模店舗向け シフト・勤怠・給与管理アプリ / 日本国内専用）

本書は要件定義（[requirements.md](requirements.md)）を受けて、システムの全体像・方式・
主要画面・データ・外部連携・非機能要件を定義する。詳細なロジック・I/F仕様は
[詳細設計書](detailed-design.md)に記載する。

---

## 1. システム概要

### 1.1 目的
小規模〜中規模店舗向けに「無料で打刻だけ使える」入口を提供し、シフト作成・給与計算を
有料（プロプラン）で解放するサブスクリプション型 SaaS。汎用勤怠ツールが過剰な
小規模店舗を主対象とする。

### 1.2 利用者と役割

| ロール | 認証 | 主な操作 |
|---|---|---|
| オーナー | Supabase Auth（メール+パスワード） | 店舗・スタッフ・シフト・給与・課金の全管理 |
| マネージャー | 同上 | 所属店舗の管理（`shop_staff.role='manager'`、UIは将来実装） |
| スタッフ | Supabase Auth（招待から作成） | 打刻・シフト確認・希望提出・給与明細閲覧 |
| 打刻端末（キオスク） | 認証なし（店舗URL + PIN） | 共有タブレットからの出退勤打刻 |

### 1.3 提供プラン

| プラン | 料金 | 制約 |
|---|---|---|
| フリー | 無料（広告あり） | 打刻のみ / 1店舗 / 5名まで |
| プロ（月） | ¥150/人/月 | 制限解除・広告なし・シフト/給与計算 |
| プロ（年） | ¥150×10ヶ月/人/年 | 同上（2ヶ月分お得） |

課金は Stripe Checkout / Webhook で管理。プロ判定は `subscriptions.status ∈ {active, trialing}`。

---

## 2. システム構成

### 2.1 技術方式

| 層 | 採用技術 |
|---|---|
| フロント/サーバー | Next.js 16（App Router, Server Components, Server Actions） |
| 認証 | Supabase Auth（@supabase/ssr、Cookieセッション） |
| DB | Supabase（PostgreSQL）+ RLS |
| 決済 | Stripe（Checkout / Billing / Webhook） |
| 通知 | Web Push（VAPID）+ Service Worker（`public/sw.js`） |
| 広告 | Google AdSense（フリープランのみ・本番設定待ち） |
| ホスティング | Cloudflare Pages（`@cloudflare/next-on-pages`） |
| タイムゾーン | 全画面・全計算で `Asia/Tokyo` 固定（国内専用） |

### 2.2 構成図（論理）

```
[ブラウザ / 共有タブレット]
        │ HTTPS
        ▼
[Next.js (App Router) on Cloudflare Pages]
  ├─ middleware: 認証ガード（公開パス以外は未ログインを /login へ）
  ├─ Server Components: 画面描画（admin clientで取得）
  ├─ Server Actions: 打刻・シフト・給与・希望シフト等の更新
  └─ Route Handlers: /api/stripe/* , /api/push/subscribe
        │                         │
        │ service_role            │ webhook署名検証
        ▼                         ▼
[Supabase PostgreSQL + RLS]   [Stripe]
        ▲
        │ Web Push (VAPID)
[Service Worker / push_subscriptions]
```

### 2.3 認証・セッション方式
- Supabase Auth のメール+パスワード。セッションは Cookie（`@supabase/ssr`）。
- `src/middleware.ts` → `updateSession()` が全リクエストでユーザーを検証し、
  公開パス（`/login`, `/signup`, `/invite`, `/kiosk`, `/punch-complete`, `/`）以外で
  未ログインなら `/login` にリダイレクト。
- ログイン後の振り分け: スタッフ（`staff.user_id` が一致）は `/punch`、
  オーナーは `/dashboard`。

### 2.4 データアクセス方式（重要）
- アプリのデータ取得・更新は原則 **service_role クライアント**（`createAdminClient()`）を用い、
  **アプリ層で所有者/所属チェックを行う**方式。
- RLS ポリシーは全テーブルに定義済みだが、service_role はこれを迂回するため、
  認可は各 Server Action / Route の明示チェックに依存する。
  → セキュリティ上の前提として[レビュー S-3](../04_review/review-2026-06-19.md) を必読。

---

## 3. 機能一覧（サブシステム単位）

| サブシステム | 機能 | 主担当画面/処理 | プラン |
|---|---|---|---|
| 認証・組織 | サインアップ/ログイン/ログアウト、組織自動作成 | `/login` `/signup` | 共通 |
| 店舗管理 | 店舗作成・編集（名称/都道府県/打刻方式/GPS/週始め） | `/shops/new` `/shops/[id]/settings` | フリー |
| スタッフ管理 | 登録（最低賃金警告）・編集・招待URL発行・5名制限 | `/shops/[id]/staff/*` | フリー（5名まで） |
| 招待 | 招待トークンからアカウント作成・staff紐付け | `/invite/[token]` → `/punch-complete` | 共通 |
| 打刻（キオスク） | スタッフ選択 + 4桁PIN、出退勤自動判定 | `/kiosk/[shopId]` | フリー |
| 打刻（スマホ） | GPS半径確認付き打刻、複数回打刻対応 | `/punch` | フリー |
| 勤怠管理 | 日次一覧・打刻修正 | `/shops/[id]/attendance` | フリー |
| シフト管理 | 週/2週/月カレンダー、複数日一括登録、予定人件費 | `/shops/[id]/shifts` | プロ |
| 希望シフト | スタッフ提出・オーナー承認/却下 | `/punch/shifts` ↔ シフト画面 | プロ |
| 給与計算 | 時給×実働、深夜割増、交通費、月次集計、CSV | `/shops/[id]/payroll/*` | プロ |
| 給与明細（スタッフ） | 自分の月次明細・年収アラート | `/punch/payroll` | プロ |
| 課金 | Stripe Checkout、Webhookでサブスク状態同期 | `/settings/billing`, `/api/stripe/*` | 共通 |
| 通知 | Web Push 購読登録、打刻後の許可リクエスト | `/api/push/subscribe`, PushPermission | フリー |
| 広告 | フリープランの確認画面/バナー表示 | AdBanner | フリー |

---

## 4. 画面設計（一覧）

### 4.1 オーナー側
| 画面 | パス | 概要 |
|---|---|---|
| ダッシュボード | `/dashboard` | 現在時刻、店舗別「今日の出勤状況」、プラン表示 |
| 店舗詳細 | `/shops/[shopId]` | 店舗メニュー（勤怠/シフト/給与/設定/スタッフ） |
| 店舗設定 | `/shops/[shopId]/settings` | 名称・都道府県・打刻方式・GPS・週始め |
| スタッフ登録/編集 | `/shops/[shopId]/staff/*` | 時給・交通費・深夜込み・最低賃金警告 |
| 勤怠記録 | `/shops/[shopId]/attendance` | 日次一覧、打刻時刻修正 |
| シフト管理 | `/shops/[shopId]/shifts` | カレンダー、一括登録、希望承認、予定人件費 |
| 給与計算 | `/shops/[shopId]/payroll` `/.../[staffId]` | 月次サマリ・日別明細・CSV |
| プラン管理 | `/settings/billing` | Checkout 起動・契約状態 |
| キオスク | `/kiosk/[shopId]` | 共有端末打刻（未認証） |

### 4.2 スタッフ側（`/punch` 配下・下部ナビあり）
| 画面 | パス | 概要 |
|---|---|---|
| 打刻 | `/punch` | GPS確認付き打刻、完了後に通知許可/広告 |
| シフト | `/punch/shifts` | 確定シフト閲覧 / 希望提出タブ |
| 給与明細 | `/punch/payroll` | 月次明細・年収アラート |
| プロフィール | `/profile` | 年収アラート閾値設定 |
| 招待完了 | `/punch-complete` | 招待受諾後の案内（未認証可・ナビなし） |

---

## 5. データ設計（概要）

詳細なカラム定義は [database.md](../02_architecture/database.md) を正とする。本書は関係のみ示す。

```
organizations ─┬─< shops ─┬─< shop_staff >─ staff ─┬─< attendances
               │          ├─< shifts               ├─< shift_requests
               │          ├─< salary_custom_items   ├─< salary_custom_records
               │          └─< shift_requests        └─< push_subscriptions
               └─< subscriptions (1:1)
staff ─ salary_settings相当（時給/交通費/アラートは staff & shop_staff に保持）
```

主要な整合性ルール:
- `attendances`: `UNIQUE(shop_id, staff_id, date)` は**撤廃**。代わりに
  「未退勤レコードは同日1件まで」を部分ユニークインデックス
  `attendances_open_punch_unique (… WHERE clocked_out_at IS NULL)` で担保（複数回打刻対応）。
- `shift_requests`: `UNIQUE(shop_id, staff_id, date)`（1日1希望、upsert）。
- `subscriptions`: `UNIQUE(organization_id)`（Webhook upsert 用）。
- `push_subscriptions`: `UNIQUE(staff_id, endpoint)`。

---

## 6. 外部連携

| 連携先 | 用途 | 方式 | 認証/検証 |
|---|---|---|---|
| Stripe | サブスク課金 | Checkout Session 作成 / Webhook受信 | Webhookは署名検証（`constructEvent`） |
| Web Push (ブラウザPush) | 出勤リマインダー等 | VAPID + Service Worker | VAPID鍵ペア |
| Google AdSense | フリープラン広告 | クライアント埋め込み | publisher ID（本番設定待ち） |
| Supabase | DB/認証 | SDK（anon / service_role） | RLS + service_roleキー |

---

## 7. 非機能要件

| 項目 | 方針 |
|---|---|
| タイムゾーン | 全処理 `Asia/Tokyo` 固定。日付境界・週境界はJSTで算出 |
| 可用性 | Cloudflare Pages + Supabase のマネージドに依存 |
| セキュリティ | 認可はアプリ層チェック必須（service_role方式）。PIN打刻はレート制限を要強化 |
| プライバシー | GPS座標は打刻記録としてのみ保存。氏名/メール/PINハッシュを保持 |
| 法令順守 | 賃金台帳の法定記載（性別等）、最低賃金チェック、深夜割増25%（労基法37条） |
| 性能 | 一覧系は店舗/月単位の限定クエリ。並列取得（Promise.all）でN+1緩和 |
| 監査 | 勤怠修正は `note`（修正理由）を保持。打刻失敗ログは今後の課題 |

---

## 8. 本設計時点の既知の前提・注意

- service_role 中心のアクセス方式のため、**新規アクション追加時は所有者/所属チェックを必須**とする。
  認可は [src/lib/auth.ts](../../src/lib/auth.ts) のヘルパに集約済み（S-3対応）。
- キオスク打刻は未認証経路だが、PINロックアウト（5回失敗で5分ロック）を実装済み（S-2対応）。
- AdSense / Stripe Webhook / VAPID は本番環境変数の設定が前提
  （[roadmap フェーズ4](../03_development/roadmap.md)）。

# 開発環境セットアップ

最終更新: 2026-06-18

---

## 必要なもの

- Node.js 20+
- Supabase アカウント（無料プロジェクト）
- Stripe アカウント（テストモード）
- Cloudflare アカウント（デプロイ時のみ）

---

## 手順

### 1. 依存関係インストール

```bash
cd clockin
npm install
```

### 2. 環境変数

`.env.local.example` をコピーして `.env.local` を作成し、各値を埋める。

```bash
cp .env.local.example .env.local
```

| 変数 | 取得場所 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase > Settings > API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase > Settings > API |
| SUPABASE_SERVICE_ROLE_KEY | Supabase > Settings > API |
| STRIPE_SECRET_KEY | Stripe > Developers > API keys |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe > Developers > API keys |
| STRIPE_WEBHOOK_SECRET | Stripe > Developers > Webhooks |

### 3. Supabase マイグレーション適用

```bash
# Supabase CLI インストール（初回のみ）
npm install -g supabase

# プロジェクトをリンク
supabase link --project-ref <project-ref>

# マイグレーション適用
supabase db push
```

または Supabase ダッシュボードの SQL エディタで `supabase/migrations/` 内の SQL を順番に実行。

### 4. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 で確認。

---

## デプロイ（Cloudflare Pages）

```bash
# Cloudflare 向けビルド
npm run build:cf

# プレビュー
npm run preview:cf

# 本番デプロイ
npm run deploy
```

Cloudflare Pages の環境変数に `.env.local` と同じ値を設定すること。

---

## コマンド一覧

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー（localhost:3000） |
| `npm run build` | Next.js ビルド（ローカル確認用） |
| `npm run build:cf` | Cloudflare Pages 向けビルド |
| `npm run preview:cf` | Cloudflare ローカルプレビュー |
| `npm run deploy` | Cloudflare Pages 本番デプロイ |
| `npm run lint` | ESLint |

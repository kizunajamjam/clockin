-- subscriptions.organization_id にユニーク制約を追加
-- （Stripe webhookのupsertに必要）
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_organization_id_key UNIQUE (organization_id);

-- プッシュ通知サブスクリプションテーブル
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (staff_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- スタッフは自分のサブスクリプションのみ管理可能
CREATE POLICY "staff own push subscriptions" ON push_subscriptions
  FOR ALL USING (
    staff_id IN (
      SELECT id FROM staff WHERE user_id = auth.uid()
    )
  );

-- サービスロールは全件アクセス可（通知送信用）
GRANT ALL ON push_subscriptions TO service_role;

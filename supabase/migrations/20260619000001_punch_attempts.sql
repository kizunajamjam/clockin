-- キオスク打刻の監査ログ（成功/失敗）＋ IP単位スロットリングの元データ
-- 無料枠（Supabase テーブル）で完結。外部サービス不要。
CREATE TABLE IF NOT EXISTS punch_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid REFERENCES shops(id) ON DELETE CASCADE,
  staff_id    uuid REFERENCES staff(id) ON DELETE SET NULL,
  success     boolean NOT NULL,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- IP単位のスロットリング集計用
CREATE INDEX IF NOT EXISTS punch_attempts_ip_time ON punch_attempts (ip, created_at);
CREATE INDEX IF NOT EXISTS punch_attempts_shop_time ON punch_attempts (shop_id, created_at);

ALTER TABLE punch_attempts ENABLE ROW LEVEL SECURITY;

-- オーナーは自店のログを閲覧可（将来の監査UI用）
CREATE POLICY "owner read punch_attempts" ON punch_attempts
  FOR SELECT USING (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );

GRANT ALL ON punch_attempts TO service_role;

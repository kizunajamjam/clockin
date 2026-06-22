-- ドリンクバックカウント（スタッフ×日付ごとの集計カウンタ）。タブレット打刻画面の専用モードから増減する。
CREATE TABLE IF NOT EXISTS drink_back_counts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id    uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date        date NOT NULL,
  count       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, staff_id, date)
);

CREATE INDEX IF NOT EXISTS drink_back_counts_shop_date ON drink_back_counts (shop_id, date);

ALTER TABLE drink_back_counts ENABLE ROW LEVEL SECURITY;

-- オーナーは自店のカウントを閲覧可（将来の直接クライアントアクセス用。現状はservice_role経由）
CREATE POLICY "owner read drink_back_counts" ON drink_back_counts
  FOR SELECT USING (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );

GRANT ALL ON drink_back_counts TO service_role;

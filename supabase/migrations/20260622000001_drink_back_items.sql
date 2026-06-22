-- ドリンクバックの項目マスタ（ドリンク/シャンパン/テキーラ等、店舗ごとにオーナーが管理）
CREATE TABLE IF NOT EXISTS drink_back_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE drink_back_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner all drink_back_items" ON drink_back_items
  FOR ALL USING (
    shop_id IN (
      SELECT s.id FROM shops s
      JOIN organizations o ON o.id = s.organization_id
      WHERE o.owner_user_id = auth.uid()
    )
  );

GRANT ALL ON drink_back_items TO service_role;

-- drink_back_counts をジャンル別カウントに対応させる（運用開始前のため既存行は破棄して必須化）
ALTER TABLE drink_back_counts ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES drink_back_items(id) ON DELETE CASCADE;
DELETE FROM drink_back_counts WHERE item_id IS NULL;
ALTER TABLE drink_back_counts ALTER COLUMN item_id SET NOT NULL;
ALTER TABLE drink_back_counts DROP CONSTRAINT IF EXISTS drink_back_counts_shop_id_staff_id_date_key;
ALTER TABLE drink_back_counts ADD CONSTRAINT drink_back_counts_shop_staff_date_item_key UNIQUE (shop_id, staff_id, date, item_id);

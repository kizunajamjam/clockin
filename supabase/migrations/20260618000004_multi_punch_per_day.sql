-- 1日複数回の出退勤に対応するためUNIQUE制約を削除
ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_shop_id_staff_id_date_key;

-- 代わりに部分インデックス：未退勤レコードは1件のみ許可
-- （同時に2か所で出勤打刻できないようにする）
CREATE UNIQUE INDEX IF NOT EXISTS attendances_open_punch_unique
  ON attendances (shop_id, staff_id, date)
  WHERE clocked_out_at IS NULL;

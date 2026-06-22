-- ドリンクバックの+1/-1ボタン用：1回のDB往復で増減を完結させる（従来は select→upsert の2往復）
CREATE OR REPLACE FUNCTION adjust_drink_back_count(
  p_shop_id uuid, p_staff_id uuid, p_date date, p_item_id uuid, p_delta integer
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO drink_back_counts (shop_id, staff_id, date, item_id, count, updated_at)
  VALUES (p_shop_id, p_staff_id, p_date, p_item_id, GREATEST(0, p_delta), now())
  ON CONFLICT (shop_id, staff_id, date, item_id)
  DO UPDATE SET count = GREATEST(0, drink_back_counts.count + p_delta), updated_at = now()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_drink_back_count(uuid, uuid, date, uuid, integer) TO service_role;

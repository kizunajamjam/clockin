CREATE TABLE IF NOT EXISTS shift_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id    uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date        date NOT NULL,
  start_time  time,
  end_time    time,
  note        text,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz DEFAULT now(),
  UNIQUE (shop_id, staff_id, date)
);

ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff own shift_requests" ON shift_requests
  FOR ALL USING (
    staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

GRANT ALL ON shift_requests TO service_role;

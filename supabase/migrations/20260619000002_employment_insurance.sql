-- 雇用保険料率（労働者負担分・小数。例: 0.006 = 0.6%）
-- 一般の事業 2024年度の労働者負担は 6/1000。建設等は別率のため店舗ごとに設定可能にする。
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS employment_insurance_rate numeric NOT NULL DEFAULT 0.006;

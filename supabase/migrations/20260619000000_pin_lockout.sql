-- キオスクPIN打刻のブルートフォース対策
-- 連続失敗回数とロック期限を staff に保持する（未認証経路のため必須）
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS pin_failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;

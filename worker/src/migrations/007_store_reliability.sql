-- Per-store schedule reliability index.
-- Computed periodically from D1 snapshot history.
-- Drives the "Watch" certainty tier for stores with unreliable schedule data.

CREATE TABLE IF NOT EXISTS store_reliability (
  slug TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  freshness_lag_avg_hours REAL,
  missing_window_rate REAL,
  forward_change_rate REAL,
  late_change_rate REAL,
  recovery_time_avg_hours REAL,
  reliability_score REAL NOT NULL,
  reliability_tier TEXT NOT NULL,
  reason TEXT,
  computed_at TEXT NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 30
);

CREATE INDEX IF NOT EXISTS idx_reliability_tier ON store_reliability(reliability_tier);
CREATE INDEX IF NOT EXISTS idx_reliability_brand ON store_reliability(brand);

-- Track cron execution results for observability.
-- One row per cron invocation. Enables detecting silent email failures,
-- tracking delivery rates, and powering a real /health endpoint.

CREATE TABLE IF NOT EXISTS cron_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handler TEXT NOT NULL,
  ran_at TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_handler ON cron_runs(handler);
CREATE INDEX IF NOT EXISTS idx_cron_runs_ran_at ON cron_runs(ran_at);

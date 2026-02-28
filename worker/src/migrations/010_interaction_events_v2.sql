-- Add referrer and device_type columns to interaction_events
-- Enables page_view events to carry traffic source and device breakdown.
ALTER TABLE interaction_events ADD COLUMN referrer TEXT;
ALTER TABLE interaction_events ADD COLUMN device_type TEXT;

CREATE INDEX IF NOT EXISTS idx_interaction_events_device_type
  ON interaction_events(device_type);

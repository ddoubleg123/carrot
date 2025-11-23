-- Create discovery_seen table for durable duplicate tracking across runs
CREATE TABLE IF NOT EXISTS discovery_seen (
  url TEXT PRIMARY KEY,
  first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  last_run_id TEXT,
  times_seen INT NOT NULL DEFAULT 1,
  patch_id TEXT,
  domain TEXT
);

CREATE INDEX IF NOT EXISTS idx_discovery_seen_patch_id ON discovery_seen(patch_id);
CREATE INDEX IF NOT EXISTS idx_discovery_seen_domain ON discovery_seen(domain);
CREATE INDEX IF NOT EXISTS idx_discovery_seen_last_seen ON discovery_seen(last_seen);

-- Add comment
COMMENT ON TABLE discovery_seen IS 'Tracks URLs seen across discovery runs to prevent re-processing';


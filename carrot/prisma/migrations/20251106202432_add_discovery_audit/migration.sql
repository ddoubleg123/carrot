-- Add discovery audit tables
CREATE TABLE "discovery_runs" (
  "id" TEXT NOT NULL,
  "patch_id" TEXT NOT NULL,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ,
  "status" TEXT NOT NULL,
  "metrics" JSONB,
  CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discovery_runs_patch_id_started_at_idx"
  ON "discovery_runs" ("patch_id", "started_at");

ALTER TABLE "discovery_runs"
  ADD CONSTRAINT "discovery_runs_patch_id_fkey"
  FOREIGN KEY ("patch_id")
  REFERENCES "patches" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE TABLE "discovery_audits" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "patch_id" TEXT NOT NULL,
  "step" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "ts" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider" TEXT,
  "query" TEXT,
  "candidate_url" TEXT,
  "final_url" TEXT,
  "http" JSONB,
  "meta" JSONB,
  "rules_hit" JSONB,
  "scores" JSONB,
  "decisions" JSONB,
  "hashes" JSONB,
  "synthesis" JSONB,
  "hero" JSONB,
  "timings" JSONB,
  "error" JSONB,
  CONSTRAINT "discovery_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discovery_audits_run_id_ts_idx"
  ON "discovery_audits" ("run_id", "ts");

CREATE INDEX "discovery_audits_patch_id_idx"
  ON "discovery_audits" ("patch_id");

ALTER TABLE "discovery_audits"
  ADD CONSTRAINT "discovery_audits_run_id_fkey"
  FOREIGN KEY ("run_id")
  REFERENCES "discovery_runs" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "discovery_audits"
  ADD CONSTRAINT "discovery_audits_patch_id_fkey"
  FOREIGN KEY ("patch_id")
  REFERENCES "patches" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

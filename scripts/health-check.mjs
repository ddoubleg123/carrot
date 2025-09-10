// scripts/health-check.mjs
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

const TIMEOUT_MS = 10_000;

const run = async () => {
  const client = new Client({ connectionString: url, statement_timeout: TIMEOUT_MS });
  try {
    await client.connect();
    const ping = await client.query("select 1 as ok");
    const mig  = await client.query(
      "select count(*)::int as ok from _prisma_migrations where success = true"
    );
    if (ping.rows[0]?.ok !== 1 || !Number.isInteger(mig.rows[0]?.ok)) {
      throw new Error("Health query unexpected");
    }
    console.log("✅ DB health OK · migrations:", mig.rows[0].ok);
  } catch (err) {
    console.error("❌ DB health FAILED:", err?.message ?? err);
    process.exit(1);
  } finally {
    try { await client.end(); } catch {}
  }
};

run();

-- CreateTable
CREATE TABLE IF NOT EXISTS "seen_urls" (
    "id" TEXT NOT NULL,
    "patch_id" TEXT NOT NULL,
    "url_hash" VARCHAR(64) NOT NULL,
    "url_normalized" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "times_seen" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "seen_urls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "seen_urls_patch_id_url_hash_key" ON "seen_urls"("patch_id", "url_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "seen_urls_patch_id_last_seen_at_idx" ON "seen_urls"("patch_id", "last_seen_at");

-- AddForeignKey
ALTER TABLE "seen_urls" ADD CONSTRAINT "seen_urls_patch_id_fkey" FOREIGN KEY ("patch_id") REFERENCES "patches"("id") ON DELETE CASCADE ON UPDATE CASCADE;


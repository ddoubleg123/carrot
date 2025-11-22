-- CreateEnum
CREATE TYPE "HeroStatus" AS ENUM ('DRAFT', 'READY', 'ERROR');

-- CreateTable
CREATE TABLE "heroes" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "quote_html" TEXT,
    "quote_char_count" INTEGER DEFAULT 0,
    "image_url" TEXT,
    "source_url" TEXT NOT NULL,
    "status" "HeroStatus" NOT NULL DEFAULT 'DRAFT',
    "error_code" VARCHAR(50),
    "error_message" TEXT,
    "trace_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "heroes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "heroes_content_id_key" ON "heroes"("content_id");

-- CreateIndex
CREATE INDEX "heroes_content_id_idx" ON "heroes"("content_id");

-- CreateIndex
CREATE INDEX "heroes_status_idx" ON "heroes"("status");

-- CreateIndex
CREATE INDEX "heroes_trace_id_idx" ON "heroes"("trace_id");

-- CreateIndex
CREATE INDEX "heroes_created_at_idx" ON "heroes"("created_at");

-- AddForeignKey
ALTER TABLE "heroes" ADD CONSTRAINT "heroes_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "discovered_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;


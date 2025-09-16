-- AlterTable
ALTER TABLE "public"."posts" ADD COLUMN     "videoBucket" VARCHAR(191),
ADD COLUMN     "videoPath" TEXT;

-- CreateIndex
CREATE INDEX "posts_videoBucket_videoPath_idx" ON "public"."posts"("videoBucket", "videoPath");

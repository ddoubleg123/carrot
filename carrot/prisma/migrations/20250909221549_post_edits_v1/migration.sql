-- AlterTable
ALTER TABLE "public"."posts" ADD COLUMN     "editCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedBy" TEXT;

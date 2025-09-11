-- CreateEnum
CREATE TYPE "public"."VisualStyle" AS ENUM ('liquid', 'radial', 'arc');

-- AlterTable
ALTER TABLE "public"."posts" ADD COLUMN     "visualSeed" TEXT,
ADD COLUMN     "visualStyle" "public"."VisualStyle";

-- CreateTable
CREATE TABLE "public"."UserPref" (
    "userId" TEXT NOT NULL,
    "captionsDefault" BOOLEAN NOT NULL DEFAULT true,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "autoplay" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPref_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "public"."UserPref" ADD CONSTRAINT "UserPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

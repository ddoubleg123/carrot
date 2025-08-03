/*
  Warnings:

  - Added the required column `content` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gradientDirection` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gradientFromColor` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gradientToColor` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "gradientDirection" TEXT NOT NULL,
    "gradientFromColor" TEXT NOT NULL,
    "gradientViaColor" TEXT,
    "gradientToColor" TEXT NOT NULL,
    "imageUrls" JSONB,
    "gifUrl" TEXT,
    "audioUrl" TEXT,
    "emoji" TEXT,
    "carrotText" TEXT,
    "stickText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("id", "userId") SELECT "id", "userId" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

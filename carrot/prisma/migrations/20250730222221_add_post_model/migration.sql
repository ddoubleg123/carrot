/*
  Warnings:

  - A unique constraint covering the columns `[userId,questionId]` on the table `OnboardingAnswer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingAnswer_userId_questionId_key" ON "OnboardingAnswer"("userId", "questionId");

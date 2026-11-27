CREATE TABLE IF NOT EXISTS "mail_threads" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "subject" TEXT,
  "outside" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "mail_threads_kind_outside_idx" ON "mail_threads"("kind", "outside");

CREATE TABLE IF NOT EXISTS "mail_members" (
  "id" TEXT PRIMARY KEY,
  "thread_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "unread" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "mail_members_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mail_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mail_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "mail_members_thread_id_user_id_key" ON "mail_members"("thread_id", "user_id");
CREATE INDEX IF NOT EXISTS "mail_members_user_id_idx" ON "mail_members"("user_id");

CREATE TABLE IF NOT EXISTS "mail_messages" (
  "id" TEXT PRIMARY KEY,
  "thread_id" TEXT NOT NULL,
  "sender_id" TEXT,
  "direction" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "image" TEXT,
  "from_addr" TEXT,
  "to_addr" TEXT,
  "state" TEXT NOT NULL DEFAULT 'sent',
  "fail_reason" TEXT,
  "external_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mail_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mail_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "mail_messages_external_id_key" ON "mail_messages"("external_id");
CREATE INDEX IF NOT EXISTS "mail_messages_thread_id_created_at_idx" ON "mail_messages"("thread_id", "created_at");

CREATE TABLE IF NOT EXISTS "mail_typing" (
  "thread_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mail_typing_pkey" PRIMARY KEY ("thread_id", "user_id"),
  CONSTRAINT "mail_typing_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mail_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mail_typing_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

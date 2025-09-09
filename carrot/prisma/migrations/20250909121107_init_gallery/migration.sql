-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "profilePhoto" TEXT,
    "profile_photo_path" TEXT,
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "metadata" JSONB,
    "interests" TEXT,
    "tos_accepted_at" TIMESTAMP(3),
    "privacy_accepted_at" TIMESTAMP(3),
    "tos_version" TEXT,
    "privacy_version" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."posts" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gradientDirection" TEXT,
    "gradientFromColor" TEXT,
    "gradientViaColor" TEXT,
    "gradientToColor" TEXT,
    "imageUrls" TEXT,
    "gifUrl" TEXT,
    "audioUrl" TEXT,
    "audioTranscription" TEXT,
    "transcriptionStatus" TEXT,
    "emoji" TEXT,
    "carrotText" TEXT,
    "stickText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "thumbnailUrl" TEXT,
    "videoUrl" TEXT,
    "cf_uid" TEXT,
    "cf_status" TEXT,
    "cf_duration_sec" DOUBLE PRECISION,
    "cf_width" INTEGER,
    "cf_height" INTEGER,
    "cf_playback_url_hls" TEXT,
    "caption_vtt_url" TEXT,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OnboardingQuestion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,

    CONSTRAINT "OnboardingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OnboardingAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" JSONB NOT NULL,

    CONSTRAINT "OnboardingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."ingest_jobs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,
    "post_id" TEXT,
    "source_url" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER,
    "error" TEXT,
    "media_url" TEXT,
    "video_url" TEXT,
    "thumbnail_url" TEXT,
    "cf_uid" TEXT,
    "cf_status" TEXT,
    "duration_sec" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "title" TEXT,
    "channel" TEXT,

    CONSTRAINT "ingest_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."source_assets" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "source_url_raw" TEXT NOT NULL,
    "source_url_normalized" TEXT NOT NULL,
    "external_id" TEXT,
    "storage_uri" TEXT,
    "content_hash" TEXT,
    "duration_sec" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "fps" DOUBLE PRECISION,
    "title" TEXT,
    "author_handle" TEXT,
    "published_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "version" INTEGER NOT NULL DEFAULT 1,
    "refcount" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_videos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'original_ref',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title_override" TEXT,
    "notes" TEXT,
    "poster_uri" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."video_variants" (
    "id" TEXT NOT NULL,
    "user_video_id" TEXT NOT NULL,
    "derived_from_asset_id" TEXT NOT NULL,
    "variant_kind" TEXT NOT NULL DEFAULT 'edit',
    "storage_uri" TEXT NOT NULL,
    "content_hash" TEXT,
    "duration_sec" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "fps" DOUBLE PRECISION,
    "edit_manifest" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingestion_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_url_raw" TEXT NOT NULL,
    "source_url_normalized" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "external_id" TEXT,
    "asset_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storage_path" TEXT,
    "thumb_url" TEXT,
    "thumb_path" TEXT,
    "title" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "duration_sec" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "in_use_count" INTEGER NOT NULL DEFAULT 0,
    "cf_uid" TEXT,
    "cf_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_labels" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "media_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_asset_labels" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,

    CONSTRAINT "media_asset_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_collections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."media_asset_collections" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,

    CONSTRAINT "media_asset_collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "public"."accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "public"."sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingQuestion_slug_key" ON "public"."OnboardingQuestion"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingAnswer_userId_questionId_key" ON "public"."OnboardingAnswer"("userId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "public"."verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "source_assets_source_url_normalized_key" ON "public"."source_assets"("source_url_normalized");

-- CreateIndex
CREATE INDEX "source_assets_content_hash_idx" ON "public"."source_assets"("content_hash");

-- CreateIndex
CREATE UNIQUE INDEX "source_assets_platform_external_id_key" ON "public"."source_assets"("platform", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_videos_user_id_asset_id_key" ON "public"."user_videos"("user_id", "asset_id");

-- CreateIndex
CREATE INDEX "video_variants_derived_from_asset_id_idx" ON "public"."video_variants"("derived_from_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_jobs_idempotency_key_key" ON "public"."ingestion_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "media_assets_user_id_idx" ON "public"."media_assets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_user_id_url_key" ON "public"."media_assets"("user_id", "url");

-- CreateIndex
CREATE INDEX "media_labels_user_id_idx" ON "public"."media_labels"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_labels_user_id_name_key" ON "public"."media_labels"("user_id", "name");

-- CreateIndex
CREATE INDEX "media_asset_labels_label_id_idx" ON "public"."media_asset_labels"("label_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_labels_asset_id_label_id_key" ON "public"."media_asset_labels"("asset_id", "label_id");

-- CreateIndex
CREATE INDEX "media_collections_user_id_idx" ON "public"."media_collections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_collections_user_id_name_key" ON "public"."media_collections"("user_id", "name");

-- CreateIndex
CREATE INDEX "media_asset_collections_collection_id_idx" ON "public"."media_asset_collections"("collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_collections_asset_id_collection_id_key" ON "public"."media_asset_collections"("asset_id", "collection_id");

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."posts" ADD CONSTRAINT "posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingAnswer" ADD CONSTRAINT "OnboardingAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OnboardingAnswer" ADD CONSTRAINT "OnboardingAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."OnboardingQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_videos" ADD CONSTRAINT "user_videos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_videos" ADD CONSTRAINT "user_videos_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."source_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_variants" ADD CONSTRAINT "video_variants_user_video_id_fkey" FOREIGN KEY ("user_video_id") REFERENCES "public"."user_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_variants" ADD CONSTRAINT "video_variants_derived_from_asset_id_fkey" FOREIGN KEY ("derived_from_asset_id") REFERENCES "public"."source_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."source_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_assets" ADD CONSTRAINT "media_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_labels" ADD CONSTRAINT "media_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_asset_labels" ADD CONSTRAINT "media_asset_labels_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_asset_labels" ADD CONSTRAINT "media_asset_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "public"."media_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_collections" ADD CONSTRAINT "media_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_asset_collections" ADD CONSTRAINT "media_asset_collections_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."media_asset_collections" ADD CONSTRAINT "media_asset_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."media_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

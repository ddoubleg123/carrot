-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storage_path" TEXT,
    "thumb_url" TEXT,
    "thumb_path" TEXT,
    "title" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "duration_sec" REAL,
    "width" INTEGER,
    "height" INTEGER,
    "in_use_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "cf_uid" TEXT,
    "cf_status" TEXT,
    CONSTRAINT "media_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media_labels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "media_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media_asset_labels" (
    "asset_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,

    PRIMARY KEY ("asset_id", "label_id"),
    CONSTRAINT "media_asset_labels_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "media_asset_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "media_labels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media_collections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "media_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media_collection_items" (
    "collection_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("collection_id", "asset_id"),
    CONSTRAINT "media_collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "media_collections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "media_collection_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "media_assets_user_id_created_at_idx" ON "media_assets"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_labels_user_id_name_key" ON "media_labels"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "media_collections_user_id_name_key" ON "media_collections"("user_id", "name");

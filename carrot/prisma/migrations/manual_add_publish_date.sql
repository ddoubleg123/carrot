-- Manual migration to add publish_date column to discovered_content
-- This column already exists in Prisma schema but not in database

-- Add publish_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'discovered_content' 
        AND column_name = 'publish_date'
    ) THEN
        ALTER TABLE "discovered_content"
        ADD COLUMN "publish_date" TIMESTAMP(3);
        
        RAISE NOTICE 'Added publish_date column to discovered_content';
    ELSE
        RAISE NOTICE 'Column publish_date already exists';
    END IF;
END $$;


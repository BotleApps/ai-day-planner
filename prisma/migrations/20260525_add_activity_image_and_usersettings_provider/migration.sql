-- AlterTable: add optional image/maps columns to Activity
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "mapsUrl" TEXT;

-- AlterTable: add provider and Gemini fields to UserSettings
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'sap';
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "geminiApiKeyEnc" TEXT NOT NULL DEFAULT '';
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "geminiModel" TEXT NOT NULL DEFAULT '';

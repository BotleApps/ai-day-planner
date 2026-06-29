-- Add unique constraints to DayPlan to prevent duplicate day rows from concurrent PUT requests
-- and to backstop the application-level invariant that each plan has exactly one DayPlan per (date)
-- and per (dayNumber). Deduplicate any pre-existing duplicates by keeping the lowest id, then add
-- the constraints. The migrate-runner already wraps this entire file in a transaction.

-- Deduplicate any existing (planId, date) duplicates
DELETE FROM "DayPlan" a
USING "DayPlan" b
WHERE a.id > b.id
  AND a."planId" = b."planId"
  AND a.date = b.date;

-- Deduplicate any existing (planId, dayNumber) duplicates after the date dedupe above
DELETE FROM "DayPlan" a
USING "DayPlan" b
WHERE a.id > b.id
  AND a."planId" = b."planId"
  AND a."dayNumber" = b."dayNumber";

-- Now add the unique indexes
CREATE UNIQUE INDEX "DayPlan_planId_date_key" ON "DayPlan"("planId", "date");
CREATE UNIQUE INDEX "DayPlan_planId_dayNumber_key" ON "DayPlan"("planId", "dayNumber");

-- Add createdAt to UserSettings (additive, safe)
ALTER TABLE "UserSettings"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop redundant indexes — these fields already have @unique which creates an
-- implicit unique index, so the secondary B-tree index just wastes write IOPS.
DROP INDEX IF EXISTS "ShareLink_token_idx";
DROP INDEX IF EXISTS "ChecklistShareLink_token_idx";
DROP INDEX IF EXISTS "Plan_shareLink_idx";
DROP INDEX IF EXISTS "Checklist_shareLink_idx";

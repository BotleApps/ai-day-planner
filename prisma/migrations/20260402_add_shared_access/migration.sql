-- CreateTable: tracks which users have opened which shared plans
CREATE TABLE "SharedAccess" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "planId"     TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedAccess_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex: one record per user+plan pair
CREATE UNIQUE INDEX "SharedAccess_userId_planId_key" ON "SharedAccess"("userId", "planId");

-- Index for fast lookup by userId
CREATE INDEX "SharedAccess_userId_idx" ON "SharedAccess"("userId");

-- ForeignKey: cascade-delete when the plan is deleted
ALTER TABLE "SharedAccess" ADD CONSTRAINT "SharedAccess_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

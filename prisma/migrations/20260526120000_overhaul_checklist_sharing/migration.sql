-- AlterTable
ALTER TABLE "SharedChecklistAccess" ADD COLUMN     "linkId" TEXT,
ADD COLUMN     "permission" TEXT NOT NULL DEFAULT 'view',
ADD COLUMN     "userEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "userName" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ChecklistShareLink" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistShareLink_token_key" ON "ChecklistShareLink"("token");

-- CreateIndex
CREATE INDEX "ChecklistShareLink_token_idx" ON "ChecklistShareLink"("token");

-- CreateIndex
CREATE INDEX "ChecklistShareLink_checklistId_idx" ON "ChecklistShareLink"("checklistId");

-- AddForeignKey
ALTER TABLE "SharedChecklistAccess" ADD CONSTRAINT "SharedChecklistAccess_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ChecklistShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistShareLink" ADD CONSTRAINT "ChecklistShareLink_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

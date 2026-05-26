-- AlterTable
ALTER TABLE "SharedAccess" ADD COLUMN     "linkId" TEXT,
ADD COLUMN     "permission" TEXT NOT NULL DEFAULT 'view',
ADD COLUMN     "userEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "userName" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_token_idx" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_planId_idx" ON "ShareLink"("planId");

-- AddForeignKey
ALTER TABLE "SharedAccess" ADD CONSTRAINT "SharedAccess_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

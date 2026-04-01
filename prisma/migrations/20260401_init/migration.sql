-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "destination" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "shareLink" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wakeUpTime" TEXT NOT NULL DEFAULT '07:00',
    "sleepTime" TEXT NOT NULL DEFAULT '22:00',
    "pace" TEXT NOT NULL DEFAULT 'moderate',
    "breakFrequency" INTEGER NOT NULL DEFAULT 120,
    "breakDuration" INTEGER NOT NULL DEFAULT 15,
    "travelBuffer" INTEGER NOT NULL DEFAULT 30,
    "mealBreakfast" TEXT,
    "mealLunch" TEXT,
    "mealDinner" TEXT,
    "activityTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessibility" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dietaryRestrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayPlan" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,

    CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "dayPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'activity',
    "startTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "endTime" TEXT,
    "location" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "cost" DOUBLE PRECISION,
    "currency" TEXT,
    "weatherDependent" BOOLEAN NOT NULL DEFAULT false,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "aiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "icon" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "time" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_shareLink_key" ON "Plan"("shareLink");
CREATE INDEX "Plan_createdBy_idx" ON "Plan"("createdBy");
CREATE INDEX "Plan_shareLink_idx" ON "Plan"("shareLink");
CREATE INDEX "DayPlan_planId_idx" ON "DayPlan"("planId");
CREATE INDEX "Activity_dayPlanId_idx" ON "Activity"("dayPlanId");
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- AddForeignKey
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dayPlanId_fkey" FOREIGN KEY ("dayPlanId") REFERENCES "DayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

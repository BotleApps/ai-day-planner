-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL DEFAULT '',
    "clientSecretEnc" TEXT NOT NULL DEFAULT '',
    "authUrl" TEXT NOT NULL DEFAULT '',
    "apiUrl" TEXT NOT NULL DEFAULT '',
    "resourceGroup" TEXT NOT NULL DEFAULT 'default',
    "deploymentId" TEXT NOT NULL DEFAULT '',
    "backend" TEXT NOT NULL DEFAULT 'openai',
    "modelName" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

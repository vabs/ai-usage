-- CreateTable
CREATE TABLE "Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "plan" TEXT,
    "bankedResets" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastAttemptAt" DATETIME,
    "lastOkAt" DATETIME,
    "lastError" TEXT,
    "lastErrorKind" TEXT,
    "lastRaw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UsageWindow" (
    "accountId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "usedPct" REAL NOT NULL,
    "resetsAt" DATETIME,
    "capturedAt" DATETIME NOT NULL,

    PRIMARY KEY ("accountId", "key"),
    CONSTRAINT "UsageWindow_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "usedPct" REAL NOT NULL,
    "resetsAt" DATETIME,
    "capturedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingAuth" (
    "state" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "accountId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Account_provider_idx" ON "Account"("provider");

-- CreateIndex
CREATE INDEX "UsageSnapshot_accountId_key_capturedAt_idx" ON "UsageSnapshot"("accountId", "key", "capturedAt");

-- CreateTable
CREATE TABLE "HospitalProfile" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "facilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bookingSlotMinutes" INTEGER NOT NULL DEFAULT 20,
    "cancellationWindowHours" INTEGER NOT NULL DEFAULT 24,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalRoster" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "HospitalRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NursingAssignment" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "NursingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalContent" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "authorUserId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalReview" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "response" TEXT,
    "respondedBy" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalProfile_workplaceId_key" ON "HospitalProfile"("workplaceId");

-- CreateIndex
CREATE INDEX "HospitalRoster_tenantId_workplaceId_startsAt_idx" ON "HospitalRoster"("tenantId", "workplaceId", "startsAt");

-- CreateIndex
CREATE INDEX "NursingAssignment_tenantId_workplaceId_userId_endedAt_idx" ON "NursingAssignment"("tenantId", "workplaceId", "userId", "endedAt");

-- CreateIndex
CREATE INDEX "HospitalContent_tenantId_workplaceId_status_idx" ON "HospitalContent"("tenantId", "workplaceId", "status");

-- CreateIndex
CREATE INDEX "HospitalReview_tenantId_workplaceId_createdAt_idx" ON "HospitalReview"("tenantId", "workplaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "HospitalProfile" ADD CONSTRAINT "HospitalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalProfile" ADD CONSTRAINT "HospitalProfile_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalRoster" ADD CONSTRAINT "HospitalRoster_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalRoster" ADD CONSTRAINT "HospitalRoster_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalRoster" ADD CONSTRAINT "HospitalRoster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingAssignment" ADD CONSTRAINT "NursingAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingAssignment" ADD CONSTRAINT "NursingAssignment_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingAssignment" ADD CONSTRAINT "NursingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingAssignment" ADD CONSTRAINT "NursingAssignment_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalContent" ADD CONSTRAINT "HospitalContent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalContent" ADD CONSTRAINT "HospitalContent_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalReview" ADD CONSTRAINT "HospitalReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalReview" ADD CONSTRAINT "HospitalReview_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "NursingAssignment_active_key" ON "NursingAssignment" ("encounterId", "userId") WHERE "endedAt" IS NULL;
ALTER TABLE "HospitalRoster" ADD CONSTRAINT "HospitalRoster_valid_interval" CHECK ("endsAt" > "startsAt");
ALTER TABLE "HospitalReview" ADD CONSTRAINT "HospitalReview_valid_rating" CHECK (rating BETWEEN 1 AND 5);

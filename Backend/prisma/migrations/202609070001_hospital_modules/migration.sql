-- AlterTable
ALTER TABLE "billing_invoices" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "requestHash" TEXT;

-- AlterTable
ALTER TABLE "payment_txns" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "requestHash" TEXT;

-- AlterTable
ALTER TABLE "user_accounts" ADD COLUMN     "authUserId" TEXT;

-- AlterTable
ALTER TABLE "workplaces" ADD COLUMN     "siteId" TEXT,
ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- CreateTable
CREATE TABLE "HospitalInvoiceLine" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "serviceCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "HospitalInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalRefund" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalPayer" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contactEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HospitalPayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" UUID NOT NULL,
    "payerId" UUID NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "preauthorizationNumber" TEXT,
    "claimedAmount" DECIMAL(10,2) NOT NULL,
    "approvedAmount" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalWard" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "HospitalWard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalBed" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "wardId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "dailyRate" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "HospitalBed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalAdmission" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "bedId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ADMITTED',
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    "dischargeSummary" TEXT,
    "nursingCleared" BOOLEAN NOT NULL DEFAULT false,
    "doctorCleared" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HospitalAdmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NursingNote" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NursingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationAdministration" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "prescriptionMedicationId" UUID NOT NULL,
    "administeredBy" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "MedicationAdministration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalSurgery" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "surgeonId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "procedure" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "consentRecorded" BOOLEAN NOT NULL DEFAULT false,
    "preOpCleared" BOOLEAN NOT NULL DEFAULT false,
    "operativeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalSurgery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyCase" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "triageLevel" TEXT NOT NULL,
    "complaint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalVisitor" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),

    CONSTRAINT "HospitalVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyBatch" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "medicineName" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PharmacyBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyDispense" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "prescriptionMedicationId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "dispensedBy" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "dispensedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyDispense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RadiologyStudy" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "modality" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "findings" TEXT,
    "impression" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "reportedBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RadiologyStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalDocument" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "patientId" UUID,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalIncident" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "reportedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalAmbulance" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "HospitalAmbulance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbulanceTrip" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "patientId" UUID,
    "ambulanceId" UUID NOT NULL,
    "pickup" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISPATCHED',
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AmbulanceTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalOutbox" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalLabService" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "testId" TEXT NOT NULL,
    "serviceId" UUID NOT NULL,

    CONSTRAINT "HospitalLabService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HospitalInvoiceLine_tenantId_invoiceId_idx" ON "HospitalInvoiceLine"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "HospitalRefund_tenantId_status_idx" ON "HospitalRefund"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalRefund_invoiceId_idempotencyKey_key" ON "HospitalRefund"("invoiceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalPayer_tenantId_name_key" ON "HospitalPayer"("tenantId", "name");

-- CreateIndex
CREATE INDEX "InsuranceClaim_tenantId_status_idx" ON "InsuranceClaim"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_invoiceId_payerId_policyNumber_key" ON "InsuranceClaim"("invoiceId", "payerId", "policyNumber");

-- CreateIndex
CREATE INDEX "HospitalWard_tenantId_workplaceId_idx" ON "HospitalWard"("tenantId", "workplaceId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalWard_workplaceId_name_key" ON "HospitalWard"("workplaceId", "name");

-- CreateIndex
CREATE INDEX "HospitalBed_tenantId_status_idx" ON "HospitalBed"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalBed_workplaceId_code_key" ON "HospitalBed"("workplaceId", "code");

-- CreateIndex
CREATE INDEX "HospitalAdmission_tenantId_workplaceId_status_idx" ON "HospitalAdmission"("tenantId", "workplaceId", "status");

-- CreateIndex
CREATE INDEX "HospitalAdmission_patientId_idx" ON "HospitalAdmission"("patientId");

-- CreateIndex
CREATE INDEX "NursingNote_tenantId_encounterId_recordedAt_idx" ON "NursingNote"("tenantId", "encounterId", "recordedAt");

-- CreateIndex
CREATE INDEX "MedicationAdministration_tenantId_encounterId_idx" ON "MedicationAdministration"("tenantId", "encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicationAdministration_prescriptionMedicationId_scheduled_key" ON "MedicationAdministration"("prescriptionMedicationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "HospitalSurgery_tenantId_workplaceId_startsAt_idx" ON "HospitalSurgery"("tenantId", "workplaceId", "startsAt");

-- CreateIndex
CREATE INDEX "EmergencyCase_tenantId_workplaceId_status_idx" ON "EmergencyCase"("tenantId", "workplaceId", "status");

-- CreateIndex
CREATE INDEX "HospitalVisitor_tenantId_workplaceId_checkedInAt_idx" ON "HospitalVisitor"("tenantId", "workplaceId", "checkedInAt");

-- CreateIndex
CREATE INDEX "PharmacyBatch_tenantId_expiresAt_idx" ON "PharmacyBatch"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyBatch_workplaceId_medicineName_batchNumber_key" ON "PharmacyBatch"("workplaceId", "medicineName", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyDispense_tenantId_idempotencyKey_key" ON "PharmacyDispense"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RadiologyStudy_orderId_key" ON "RadiologyStudy"("orderId");

-- CreateIndex
CREATE INDEX "RadiologyStudy_tenantId_workplaceId_status_idx" ON "RadiologyStudy"("tenantId", "workplaceId", "status");

-- CreateIndex
CREATE INDEX "HospitalDocument_tenantId_workplaceId_category_idx" ON "HospitalDocument"("tenantId", "workplaceId", "category");

-- CreateIndex
CREATE INDEX "HospitalIncident_tenantId_workplaceId_status_idx" ON "HospitalIncident"("tenantId", "workplaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalAmbulance_tenantId_registrationNumber_key" ON "HospitalAmbulance"("tenantId", "registrationNumber");

-- CreateIndex
CREATE INDEX "AmbulanceTrip_tenantId_workplaceId_status_idx" ON "AmbulanceTrip"("tenantId", "workplaceId", "status");

-- CreateIndex
CREATE INDEX "HospitalOutbox_tenantId_status_availableAt_idx" ON "HospitalOutbox"("tenantId", "status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalLabService_workplaceId_testId_key" ON "HospitalLabService"("workplaceId", "testId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_workplaceId_idempotencyKey_key" ON "billing_invoices"("workplaceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payment_txns_invoiceId_idempotencyKey_key" ON "payment_txns"("invoiceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_authUserId_key" ON "user_accounts"("authUserId");

-- CreateIndex
CREATE INDEX "workplaces_tenantId_siteId_idx" ON "workplaces"("tenantId", "siteId");

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workplaces" ADD CONSTRAINT "workplaces_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workplaces" ADD CONSTRAINT "workplaces_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalInvoiceLine" ADD CONSTRAINT "HospitalInvoiceLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalInvoiceLine" ADD CONSTRAINT "HospitalInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "billing_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalRefund" ADD CONSTRAINT "HospitalRefund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalRefund" ADD CONSTRAINT "HospitalRefund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "billing_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalPayer" ADD CONSTRAINT "HospitalPayer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "billing_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "HospitalPayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalWard" ADD CONSTRAINT "HospitalWard_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalWard" ADD CONSTRAINT "HospitalWard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalBed" ADD CONSTRAINT "HospitalBed_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalBed" ADD CONSTRAINT "HospitalBed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalBed" ADD CONSTRAINT "HospitalBed_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "HospitalWard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAdmission" ADD CONSTRAINT "HospitalAdmission_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAdmission" ADD CONSTRAINT "HospitalAdmission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAdmission" ADD CONSTRAINT "HospitalAdmission_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAdmission" ADD CONSTRAINT "HospitalAdmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAdmission" ADD CONSTRAINT "HospitalAdmission_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "HospitalBed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingNote" ADD CONSTRAINT "NursingNote_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingNote" ADD CONSTRAINT "NursingNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingNote" ADD CONSTRAINT "NursingNote_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NursingNote" ADD CONSTRAINT "NursingNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_prescriptionMedicationId_fkey" FOREIGN KEY ("prescriptionMedicationId") REFERENCES "prescription_medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalSurgery" ADD CONSTRAINT "HospitalSurgery_surgeonId_fkey" FOREIGN KEY ("surgeonId") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalSurgery" ADD CONSTRAINT "HospitalSurgery_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "clinic_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalSurgery" ADD CONSTRAINT "HospitalSurgery_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalSurgery" ADD CONSTRAINT "HospitalSurgery_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalSurgery" ADD CONSTRAINT "HospitalSurgery_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalSurgery" ADD CONSTRAINT "HospitalSurgery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyCase" ADD CONSTRAINT "EmergencyCase_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyCase" ADD CONSTRAINT "EmergencyCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyCase" ADD CONSTRAINT "EmergencyCase_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyCase" ADD CONSTRAINT "EmergencyCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalVisitor" ADD CONSTRAINT "HospitalVisitor_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalVisitor" ADD CONSTRAINT "HospitalVisitor_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalVisitor" ADD CONSTRAINT "HospitalVisitor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyBatch" ADD CONSTRAINT "PharmacyBatch_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyBatch" ADD CONSTRAINT "PharmacyBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_prescriptionMedicationId_fkey" FOREIGN KEY ("prescriptionMedicationId") REFERENCES "prescription_medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyStudy" ADD CONSTRAINT "RadiologyStudy_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "investigation_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyStudy" ADD CONSTRAINT "RadiologyStudy_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadiologyStudy" ADD CONSTRAINT "RadiologyStudy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalDocument" ADD CONSTRAINT "HospitalDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalDocument" ADD CONSTRAINT "HospitalDocument_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalDocument" ADD CONSTRAINT "HospitalDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalIncident" ADD CONSTRAINT "HospitalIncident_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalIncident" ADD CONSTRAINT "HospitalIncident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAmbulance" ADD CONSTRAINT "HospitalAmbulance_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalAmbulance" ADD CONSTRAINT "HospitalAmbulance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbulanceTrip" ADD CONSTRAINT "AmbulanceTrip_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbulanceTrip" ADD CONSTRAINT "AmbulanceTrip_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbulanceTrip" ADD CONSTRAINT "AmbulanceTrip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbulanceTrip" ADD CONSTRAINT "AmbulanceTrip_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "HospitalAmbulance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOutbox" ADD CONSTRAINT "HospitalOutbox_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOutbox" ADD CONSTRAINT "HospitalOutbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalLabService" ADD CONSTRAINT "HospitalLabService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalLabService" ADD CONSTRAINT "HospitalLabService_workplaceId_fkey" FOREIGN KEY ("workplaceId") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalLabService" ADD CONSTRAINT "HospitalLabService_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalLabService" ADD CONSTRAINT "HospitalLabService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "clinic_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants that Prisma's schema language cannot express.
CREATE UNIQUE INDEX "HospitalAdmission_active_bed_key" ON "HospitalAdmission" ("bedId") WHERE status = 'ADMITTED';
CREATE UNIQUE INDEX "HospitalAdmission_active_patient_key" ON "HospitalAdmission" ("patientId") WHERE status = 'ADMITTED';
CREATE UNIQUE INDEX "AmbulanceTrip_active_vehicle_key" ON "AmbulanceTrip" ("ambulanceId") WHERE status IN ('DISPATCHED', 'PATIENT_PICKED_UP');
ALTER TABLE "PharmacyBatch" ADD CONSTRAINT "PharmacyBatch_nonnegative" CHECK (quantity >= 0 AND "unitPrice" >= 0);
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_positive" CHECK (quantity > 0);
ALTER TABLE "HospitalInvoiceLine" ADD CONSTRAINT "HospitalInvoiceLine_valid_amount" CHECK (quantity > 0 AND "unitPrice" >= 0 AND amount = quantity * "unitPrice");
ALTER TABLE "HospitalRefund" ADD CONSTRAINT "HospitalRefund_positive" CHECK (amount > 0);
ALTER TABLE "HospitalSurgery" ADD CONSTRAINT "HospitalSurgery_valid_interval" CHECK ("endsAt" > "startsAt");
ALTER TABLE "HospitalBed" ADD CONSTRAINT "HospitalBed_valid_status" CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'));
ALTER TABLE "HospitalAdmission" ADD CONSTRAINT "HospitalAdmission_valid_status" CHECK (status IN ('ADMITTED', 'DISCHARGED'));
ALTER TABLE "HospitalRefund" ADD CONSTRAINT "HospitalRefund_valid_status" CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'));

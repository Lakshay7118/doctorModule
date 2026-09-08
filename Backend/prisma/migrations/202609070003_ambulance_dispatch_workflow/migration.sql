-- Extend the hospital ambulance registry and dispatch ledger to match the
-- operational workflow used by hospital administration.
ALTER TABLE "HospitalAmbulance"
ADD COLUMN "driverLicense" TEXT,
ADD COLUMN "driverShift" TEXT,
ADD COLUMN "equipment" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "baseLocation" TEXT NOT NULL DEFAULT '',
ADD COLUMN "crew" JSONB,
ADD COLUMN "telemetry" JSONB,
ADD COLUMN "maintenanceNotes" TEXT;

ALTER TABLE "AmbulanceTrip"
ADD COLUMN "emergencyCaseId" UUID,
ADD COLUMN "patientName" TEXT,
ADD COLUMN "isPatientLinked" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'URGENT',
ADD COLUMN "notes" TEXT,
ADD COLUMN "atSceneAt" TIMESTAMP(3),
ADD COLUMN "arrivedHospitalAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledReason" TEXT,
ADD COLUMN "rerouteHistory" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "reassignedFromAmbulanceId" UUID;

CREATE INDEX "AmbulanceTrip_tenantId_emergencyCaseId_idx" ON "AmbulanceTrip"("tenantId", "emergencyCaseId");

ALTER TABLE "AmbulanceTrip" ADD CONSTRAINT "AmbulanceTrip_emergencyCaseId_fkey" FOREIGN KEY ("emergencyCaseId") REFERENCES "EmergencyCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "AmbulanceTrip_active_vehicle_key";
CREATE UNIQUE INDEX "AmbulanceTrip_active_vehicle_key" ON "AmbulanceTrip" ("ambulanceId") WHERE status IN ('DISPATCHED', 'EN_ROUTE', 'RE_ROUTED', 'AT_SCENE', 'PATIENT_PICKED_UP', 'TRANSPORTING', 'AT_HOSPITAL');

ALTER TABLE "HospitalAmbulance" ADD CONSTRAINT "HospitalAmbulance_valid_status" CHECK (status IN ('AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'MAINTENANCE_OFFLINE'));
ALTER TABLE "AmbulanceTrip" ADD CONSTRAINT "AmbulanceTrip_valid_status" CHECK (status IN ('DISPATCHED', 'EN_ROUTE', 'RE_ROUTED', 'AT_SCENE', 'PATIENT_PICKED_UP', 'TRANSPORTING', 'AT_HOSPITAL', 'COMPLETED', 'CANCELLED'));
ALTER TABLE "AmbulanceTrip" ADD CONSTRAINT "AmbulanceTrip_valid_priority" CHECK (priority IN ('CRITICAL', 'URGENT', 'STANDARD'));
ALTER TABLE "AmbulanceTrip" ADD CONSTRAINT "AmbulanceTrip_cancel_reason" CHECK (status <> 'CANCELLED' OR "cancelledReason" IS NOT NULL);

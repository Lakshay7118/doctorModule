CREATE TABLE "doctor_workspace_states" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workplaceId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_workspace_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doctor_workspace_states_tenantId_workplaceId_scope_entityId_key"
ON "doctor_workspace_states"("tenantId", "workplaceId", "scope", "entityId");

CREATE INDEX "doctor_workspace_states_tenantId_scope_entityId_idx"
ON "doctor_workspace_states"("tenantId", "scope", "entityId");

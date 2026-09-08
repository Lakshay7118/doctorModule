export const SYSTEM_ROLES = ["lab_director", "quality_manager", "section_supervisor", "technologist", "accessioning", "phlebotomist", "courier", "reception_cashier", "inventory_procurement", "tenant_admin", "referring_clinician", "client_lab_user", "auditor", "hospital_doctor", "hospital_receptionist", "hospital_nurse", "hospital_billing", "billing_manager", "hospital_pharmacist", "hospital_radiologist", "hospital_operations"] as const;
export type SystemRole = typeof SYSTEM_ROLES[number];
export const INTERNAL_ROLES = SYSTEM_ROLES.filter((role) => !["referring_clinician", "client_lab_user"].includes(role)) as SystemRole[];
export const EXTERNAL_ROLES: SystemRole[] = ["referring_clinician", "client_lab_user"];

const readCore = ["dashboard.read", "patients.read", "orders.read", "specimens.read", "reports.read"];
export const ROLE_PERMISSIONS: Record<SystemRole, readonly string[]> = {
  hospital_doctor: ["hms.read", "hms.patients.read", "hms.clinical.read", "hms.clinical.write", "hms.appointments.read", "hms.appointments.write", "hms.care.read", "hms.discharge.doctor", "hms.surgery.write", "hms.communication.write"],
  hospital_receptionist: ["hms.read", "hms.patients.read", "hms.patients.write", "hms.appointments.read", "hms.appointments.write", "hms.care.read", "hms.admissions.write", "hms.visitors.write", "hms.communication.write"],
  hospital_nurse: ["hms.read", "hms.patients.read", "hms.clinical.read", "hms.care.read", "hms.nursing.write", "hms.discharge.nursing", "hms.communication.write"],
  hospital_billing: ["hms.read", "hms.patients.read", "hms.billing.read", "hms.billing.write", "hms.billing.payment", "hms.billing.refund", "hms.insurance.write"],
  billing_manager: ["hms.read", "hms.patients.read", "hms.billing.read", "hms.billing.write", "hms.billing.payment", "hms.billing.refund", "hms.billing.approve", "hms.insurance.write"],
  hospital_pharmacist: ["hms.read", "hms.patients.read", "hms.pharmacy.read", "hms.pharmacy.write"],
  hospital_radiologist: ["hms.read", "hms.patients.read", "hms.radiology.read", "hms.radiology.write"],
  hospital_operations: ["hms.read", "hms.patients.read", "hms.care.read", "hms.admissions.write", "hms.visitors.write", "hms.operations.write", "hms.documents.write", "hms.communication.write"],
  lab_director: [...readCore, "patients.write", "orders.write", "results.read", "results.write", "results.technical_review", "results.medical_validate", "reports.release", "quality.read", "quality.write", "inventory.read", "equipment.read", "logistics.read", "communications.read", "analytics.read", "audit.read"],
  quality_manager: ["dashboard.read", "orders.read", "specimens.read", "results.read", "reports.read", "quality.read", "quality.write", "quality.override", "audit.read"],
  section_supervisor: [...readCore, "results.read", "results.write", "results.technical_review", "quality.read", "quality.write", "workbench.write"],
  technologist: ["dashboard.read", "orders.read", "specimens.read", "specimen.accession", "results.read", "results.write", "workbench.write"],
  accessioning: ["dashboard.read", "orders.read", "specimens.read", "specimen.receive", "specimen.accession", "specimen.reject", "logistics.read"],
  phlebotomist: ["dashboard.read", "patients.read", "orders.read", "orders.write", "specimens.read", "collection.confirm", "logistics.read"],
  courier: ["dashboard.read", "orders.read", "specimens.read", "collection.confirm", "logistics.read", "logistics.write"],
  reception_cashier: ["dashboard.read", "patients.read", "patients.write", "orders.read", "orders.write", "specimens.read", "reports.read", "billing.read", "billing.estimate", "billing.invoice", "billing.payment", "billing.refund", "communications.read", "communications.send"],
  inventory_procurement: ["dashboard.read", "inventory.read", "inventory.write", "equipment.read", "equipment.write"],
  tenant_admin: ["dashboard.read", "patients.read", "orders.read", "specimens.read", "results.read", "reports.read", "quality.read", "inventory.read", "equipment.read", "billing.read", "billing.contracts", "logistics.read", "communications.read", "communications.write", "analytics.read", "admin.users", "admin.roles", "admin.approvals", "audit.read", "integrations.manage"],
  referring_clinician: ["patients.read", "patients.write", "orders.read.own", "reports.read.own"],
  client_lab_user: ["patients.read.client", "orders.read.client", "orders.write.client", "reports.read.client", "billing.read.client"],
  auditor: ["dashboard.read", "patients.read", "orders.read", "specimens.read", "results.read", "reports.read", "quality.read", "inventory.read", "billing.read", "communications.read", "analytics.read", "audit.read"]
};

// Administrative access does not imply permission to prescribe, administer medication,
ROLE_PERMISSIONS.hospital_doctor = [...ROLE_PERMISSIONS.hospital_doctor, "hms.vitals.write"];
ROLE_PERMISSIONS.hospital_nurse = [...ROLE_PERMISSIONS.hospital_nurse, "hms.vitals.write"];
// release radiology reports, or approve clinical discharge.
ROLE_PERMISSIONS.tenant_admin = [...ROLE_PERMISSIONS.tenant_admin, "hms.read", "hms.admin", "hms.patients.read", "hms.patients.write", "hms.appointments.read", "hms.appointments.write", "hms.care.read", "hms.clinical.write", "hms.nursing.write", "hms.discharge.doctor", "hms.discharge.nursing", "hms.surgery.write", "hms.vitals.write", "hms.admissions.write", "hms.visitors.write", "hms.operations.write", "hms.documents.write", "hms.communication.write", "hms.billing.read", "hms.billing.write", "hms.billing.payment", "hms.billing.refund", "hms.billing.approve", "hms.insurance.write", "hms.pharmacy.read", "hms.pharmacy.write", "hms.radiology.read", "hms.radiology.write"];

export function permissionsForRoles(roles: readonly string[]): string[] {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role as SystemRole] ?? []))];
}

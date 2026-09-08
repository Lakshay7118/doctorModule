import type { PrismaClient } from "../src/generated/prisma";
import type { SystemRole } from "../src/config/permissions";

export const HOSPITAL_SEED = {
  workplaceId: "10000000-0000-4000-8000-000000000001",
  doctorId: "10000000-0000-4000-8000-000000000002",
  accountId: "10000000-0000-4000-8000-000000000003",
  patientId: "10000000-0000-4000-8000-000000000004",
  serviceId: "10000000-0000-4000-8000-000000000005",
  wardId: "10000000-0000-4000-8000-000000000006",
  bedId: "10000000-0000-4000-8000-000000000007",
  roomId: "10000000-0000-4000-8000-000000000008",
  ambulanceId: "10000000-0000-4000-8000-000000000011",
  replacementAmbulanceId: "10000000-0000-4000-8000-000000000012",
};

type SeedUser = (input: { id: string; email: string; name: string; tenantId: string; role: SystemRole; siteId: string }) => Promise<void>;
export async function seedHospital(db: PrismaClient, tenantId: string, siteId: string, seedUser: SeedUser) {
  const staff: Array<[string, SystemRole]> = [["doctor", "hospital_doctor"], ["reception", "hospital_receptionist"], ["nurse", "hospital_nurse"], ["billing", "hospital_billing"], ["billing-manager", "billing_manager"], ["pharmacy", "hospital_pharmacist"], ["radiology", "hospital_radiologist"], ["operations", "hospital_operations"]];
  for (const [name, role] of staff) await seedUser({ id: `USR-HMS-${name.toUpperCase()}`, email: `${name}@hospital.example`, name: `Hospital ${name}`, tenantId, siteId, role });
  const user = await db.user.findUniqueOrThrow({ where: { email: "doctor@hospital.example" } });
  const now = new Date(); const s = HOSPITAL_SEED;
  await db.workplaces.upsert({ where: { id: s.workplaceId }, create: { id: s.workplaceId, name: "Sunrise Hospital", type: "HOSPITAL", tenantId, siteId, updatedAt: now }, update: { tenantId, siteId, type: "HOSPITAL", updatedAt: now } });
  await db.user_accounts.upsert({ where: { id: s.accountId }, create: { id: s.accountId, email: user.email, authUserId: user.id, updatedAt: now }, update: {} });
  await db.doctor_profiles.upsert({ where: { id: s.doctorId }, create: { id: s.doctorId, userAccountId: s.accountId, fullName: "Dr. Hospital Demo", specialty: "Internal Medicine", updatedAt: now }, update: {} });
  await db.doctor_workplaces.upsert({ where: { doctorId_workplaceId: { doctorId: s.doctorId, workplaceId: s.workplaceId } }, create: { id: "10000000-0000-4000-8000-000000000009", doctorId: s.doctorId, workplaceId: s.workplaceId, doctorRole: "CONSULTANT", updatedAt: now }, update: {} });
  await db.patients.upsert({ where: { id: s.patientId }, create: { id: s.patientId, qlynoId: "QL-HOSPITAL-DEMO", fullName: "Hospital Demo Patient", gender: "MALE", phone: "+910000000000", updatedAt: now }, update: {} });
  await db.patient_workplaces.upsert({ where: { patientId_workplaceId: { patientId: s.patientId, workplaceId: s.workplaceId } }, create: { id: "10000000-0000-4000-8000-000000000010", patientId: s.patientId, workplaceId: s.workplaceId, localMrn: "HMS-DEMO-001", updatedAt: now }, update: {} });
  await db.clinic_services.upsert({ where: { id: s.serviceId }, create: { id: s.serviceId, workplaceId: s.workplaceId, name: "OPD Consultation", price: "500.00", durationMinutes: 20, updatedAt: now }, update: {} });
  await db.hospitalWard.upsert({ where: { id: s.wardId }, create: { id: s.wardId, tenantId, workplaceId: s.workplaceId, name: "General Ward", type: "GENERAL" }, update: { tenantId, workplaceId: s.workplaceId } });
  await db.hospitalBed.upsert({ where: { id: s.bedId }, create: { id: s.bedId, tenantId, workplaceId: s.workplaceId, wardId: s.wardId, code: "GEN-01", dailyRate: "1000.00" }, update: { tenantId, workplaceId: s.workplaceId, wardId: s.wardId } });
  await db.clinic_rooms.upsert({ where: { id: s.roomId }, create: { id: s.roomId, workplaceId: s.workplaceId, name: "OT-01", roomType: "OT", updatedAt: now }, update: {} });
  await db.hospitalAmbulance.upsert({ where: { id: s.ambulanceId }, create: { id: s.ambulanceId, tenantId, workplaceId: s.workplaceId, registrationNumber: "MH-12-HMS-101", type: "ALS", driverName: "Ramesh Patel", driverPhone: "+919822011921", driverLicense: "DL-MH-2018-9921", driverShift: "Day Shift", equipment: ["Defibrillator", "Transport Ventilator", "Oxygen Tank"], baseLocation: "Sunrise Main Ambulance Bay", crew: [{ name: "Sunita Sharma", role: "PARAMEDIC", phone: "+919822055102" }] }, update: { tenantId, workplaceId: s.workplaceId } });
  await db.hospitalAmbulance.upsert({ where: { id: s.replacementAmbulanceId }, create: { id: s.replacementAmbulanceId, tenantId, workplaceId: s.workplaceId, registrationNumber: "MH-12-HMS-102", type: "BLS", driverName: "Mohan Lal", driverPhone: "+919899066211", driverLicense: "DL-MH-2020-7712", driverShift: "Night Shift", equipment: ["Oxygen Tank", "Spine Board"], baseLocation: "Sunrise City Ambulance Bay", crew: [{ name: "Amit Verma", role: "EMT", phone: "+919811077199" }] }, update: { tenantId, workplaceId: s.workplaceId } });
}

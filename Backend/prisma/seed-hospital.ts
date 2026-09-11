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
  locationId: "10000000-0000-4000-8000-000000000013",
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
  await db.workplace_locations.upsert({
    where: { id: s.locationId },
    create: {
      id: s.locationId,
      workplaceId: s.workplaceId,
      name: "Sunrise Hospital Main Campus",
      addressLine1: "Sunrise Hospital, Central Campus",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400001",
      isPrimary: true,
      updatedAt: now,
    },
    update: {
      workplaceId: s.workplaceId,
      name: "Sunrise Hospital Main Campus",
      addressLine1: "Sunrise Hospital, Central Campus",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      postalCode: "400001",
      isPrimary: true,
      updatedAt: now,
    },
  });
  await db.user_accounts.upsert({
    where: { id: s.accountId },
    create: { id: s.accountId, email: user.email, authUserId: user.id, updatedAt: now },
    update: { email: user.email, authUserId: user.id, updatedAt: now },
  });
  await db.doctor_profiles.upsert({ where: { id: s.doctorId }, create: { id: s.doctorId, userAccountId: s.accountId, fullName: "Dr. Hospital Demo", specialty: "Internal Medicine", updatedAt: now }, update: {} });
  await db.doctor_workplaces.upsert({ where: { doctorId_workplaceId: { doctorId: s.doctorId, workplaceId: s.workplaceId } }, create: { id: "10000000-0000-4000-8000-000000000009", doctorId: s.doctorId, workplaceId: s.workplaceId, doctorRole: "CONSULTANT", updatedAt: now }, update: {} });
  const staffProfiles = [
    { userEmail: "reception@hospital.example", accountId: "10000000-0000-4000-8000-000000000014", staffId: "10000000-0000-4000-8000-000000000015", linkId: "10000000-0000-4000-8000-000000000016", name: "Hospital Reception", role: "RECEPTIONIST" },
    { userEmail: "nurse@hospital.example", accountId: "10000000-0000-4000-8000-000000000017", staffId: "10000000-0000-4000-8000-000000000018", linkId: "10000000-0000-4000-8000-000000000019", name: "Hospital Nurse", role: "NURSE" },
    { userEmail: "pharmacy@hospital.example", accountId: "10000000-0000-4000-8000-000000000020", staffId: "10000000-0000-4000-8000-000000000021", linkId: "10000000-0000-4000-8000-000000000022", name: "Hospital Pharmacy", role: "PHARMACIST" },
    { userEmail: "radiology@hospital.example", accountId: "10000000-0000-4000-8000-000000000023", staffId: "10000000-0000-4000-8000-000000000024", linkId: "10000000-0000-4000-8000-000000000025", name: "Hospital Radiology", role: "TECHNICIAN" },
  ];
  for (const member of staffProfiles) {
    const staffUser = await db.user.findUniqueOrThrow({ where: { email: member.userEmail } });
    await db.user_accounts.upsert({
      where: { id: member.accountId },
      create: { id: member.accountId, email: staffUser.email, authUserId: staffUser.id, updatedAt: now },
      update: { email: staffUser.email, authUserId: staffUser.id, updatedAt: now },
    });
    await db.staff_profiles.upsert({
      where: { id: member.staffId },
      create: { id: member.staffId, userAccountId: member.accountId, fullName: member.name, role: member.role, updatedAt: now },
      update: { userAccountId: member.accountId, fullName: member.name, role: member.role, updatedAt: now },
    });
    await db.staff_workplaces.upsert({
      where: { staffId_workplaceId: { staffId: member.staffId, workplaceId: s.workplaceId } },
      create: { id: member.linkId, staffId: member.staffId, workplaceId: s.workplaceId, role: member.role, updatedAt: now },
      update: { role: member.role, status: "ACTIVE", updatedAt: now },
    });
  }
  await db.patients.upsert({ where: { id: s.patientId }, create: { id: s.patientId, qlynoId: "QL-HOSPITAL-DEMO", fullName: "Hospital Demo Patient", gender: "MALE", phone: "+910000000000", updatedAt: now }, update: {} });
  await db.patient_workplaces.upsert({ where: { patientId_workplaceId: { patientId: s.patientId, workplaceId: s.workplaceId } }, create: { id: "10000000-0000-4000-8000-000000000010", patientId: s.patientId, workplaceId: s.workplaceId, localMrn: "HMS-DEMO-001", updatedAt: now }, update: {} });
  await db.clinic_services.upsert({ where: { id: s.serviceId }, create: { id: s.serviceId, workplaceId: s.workplaceId, name: "OPD Consultation", price: "500.00", durationMinutes: 20, updatedAt: now }, update: {} });
  await db.doctor_shifts.upsert({
    where: { id: "10000000-0000-4000-8000-000000000026" },
    create: { id: "10000000-0000-4000-8000-000000000026", doctorId: s.doctorId, workplaceId: s.workplaceId, startsAt: new Date("2026-09-11T03:30:00.000Z"), endsAt: new Date("2026-09-11T12:30:00.000Z"), shiftType: "CLINIC_OPD", status: "ACTIVE", bookingEnabled: true, updatedAt: now },
    update: { status: "ACTIVE", updatedAt: now },
  });
  await db.appointments.upsert({
    where: { id: "10000000-0000-4000-8000-000000000027" },
    create: { id: "10000000-0000-4000-8000-000000000027", patientId: s.patientId, doctorId: s.doctorId, workplaceId: s.workplaceId, locationId: s.locationId, scheduledAt: new Date("2026-09-11T05:00:00.000Z"), durationMinutes: 20, mode: "IN_PERSON", status: "CHECKED_IN", reason: "Demo OPD follow-up", checkedInAt: new Date("2026-09-11T04:55:00.000Z"), updatedAt: now },
    update: { status: "CHECKED_IN", completedAt: null, updatedAt: now },
  });
  await db.tasks.upsert({
    where: { id: "10000000-0000-4000-8000-000000000028" },
    create: { id: "10000000-0000-4000-8000-000000000028", title: "Review demo follow-up labs", description: "Clinical task - Review CBC/CMP before consultation", status: "OPEN", priority: "HIGH", dueAt: new Date("2026-09-11T06:00:00.000Z"), patientId: s.patientId, workplaceId: s.workplaceId, appointmentId: "10000000-0000-4000-8000-000000000027", updatedAt: now },
    update: { status: "OPEN", completedAt: null, updatedAt: now },
  });
  await db.task_assignees.upsert({
    where: { taskId_userAccountId: { taskId: "10000000-0000-4000-8000-000000000028", userAccountId: s.accountId } },
    create: { id: "10000000-0000-4000-8000-000000000029", taskId: "10000000-0000-4000-8000-000000000028", userAccountId: s.accountId },
    update: {},
  });
  await db.conversations.upsert({
    where: { id: "10000000-0000-4000-8000-000000000030" },
    create: {
      id: "10000000-0000-4000-8000-000000000030",
      workplaceId: s.workplaceId,
      type: "CLINIC_STAFF",
      title: "Nursing coordination",
      updatedAt: now,
      conversation_participants: {
        create: [
          { id: "10000000-0000-4000-8000-000000000031", displayName: "Dr. Hospital Demo", participantType: "Doctor", userAccountId: s.accountId },
          { id: "10000000-0000-4000-8000-000000000032", displayName: "Hospital Nurse", participantType: "Nurse", userAccountId: "10000000-0000-4000-8000-000000000017" },
        ],
      },
      messages: {
        create: { id: "10000000-0000-4000-8000-000000000033", senderUserId: "10000000-0000-4000-8000-000000000017", body: "Vitals are ready for the demo OPD follow-up.", sentAt: new Date("2026-09-11T04:50:00.000Z") },
      },
    },
    update: { updatedAt: now },
  });
  await db.hospitalWard.upsert({ where: { id: s.wardId }, create: { id: s.wardId, tenantId, workplaceId: s.workplaceId, name: "General Ward", type: "GENERAL" }, update: { tenantId, workplaceId: s.workplaceId } });
  await db.hospitalBed.upsert({ where: { id: s.bedId }, create: { id: s.bedId, tenantId, workplaceId: s.workplaceId, wardId: s.wardId, code: "GEN-01", dailyRate: "1000.00" }, update: { tenantId, workplaceId: s.workplaceId, wardId: s.wardId } });
  await db.clinic_rooms.upsert({ where: { id: s.roomId }, create: { id: s.roomId, workplaceId: s.workplaceId, name: "OT-01", roomType: "OT", updatedAt: now }, update: {} });
  await db.hospitalAmbulance.upsert({ where: { id: s.ambulanceId }, create: { id: s.ambulanceId, tenantId, workplaceId: s.workplaceId, registrationNumber: "MH-12-HMS-101", type: "ALS", driverName: "Ramesh Patel", driverPhone: "+919822011921", driverLicense: "DL-MH-2018-9921", driverShift: "Day Shift", equipment: ["Defibrillator", "Transport Ventilator", "Oxygen Tank"], baseLocation: "Sunrise Main Ambulance Bay", crew: [{ name: "Sunita Sharma", role: "PARAMEDIC", phone: "+919822055102" }] }, update: { tenantId, workplaceId: s.workplaceId } });
  await db.hospitalAmbulance.upsert({ where: { id: s.replacementAmbulanceId }, create: { id: s.replacementAmbulanceId, tenantId, workplaceId: s.workplaceId, registrationNumber: "MH-12-HMS-102", type: "BLS", driverName: "Mohan Lal", driverPhone: "+919899066211", driverLicense: "DL-MH-2020-7712", driverShift: "Night Shift", equipment: ["Oxygen Tank", "Spine Board"], baseLocation: "Sunrise City Ambulance Bay", crew: [{ name: "Amit Verma", role: "EMT", phone: "+919811077199" }] }, update: { tenantId, workplaceId: s.workplaceId } });
}

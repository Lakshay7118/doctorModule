import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../../src/app";
import { prisma } from "../../src/db/prisma";
import { HOSPITAL_SEED } from "../../prisma/seed-hospital";
import { deliverOne } from "../../src/services/hospital-delivery";

const app = createApp();
const tokens: Record<string, string> = {};
const s = { ...HOSPITAL_SEED, workplaceId: randomUUID(), patientId: randomUUID(), serviceId: randomUUID() };
const workplaceId = s.workplaceId;
const w = { workplaceId };
async function login(email: string, tenantSlug = "sunrise-hospital") {
  const result = await request(app).post("/api/auth/login").send({ identifier: email, password: "QlynoDemo!2026", tenantSlug });
  if (result.status !== 200) throw new Error(`Login failed for ${email}: ${result.status} ${result.body.error?.code}`);
  return result.body.data?.accessToken ?? result.body.accessToken;
}
function post(path: string, role: string, body: Record<string, unknown> = {}) { return request(app).post(`/api/hms${path}`).auth(tokens[role]!, { type: "bearer" }).send({ ...w, ...body }); }
function patch(path: string, role: string, body: Record<string, unknown> = {}) { return request(app).patch(`/api/hms${path}`).auth(tokens[role]!, { type: "bearer" }).send({ ...w, ...body }); }
async function visit() { const result = await post("/encounters", "doctor", { patientId: s.patientId, doctorId: s.doctorId, type: "NEW_CONSULTATION", chiefComplaint: "Integration test" }); expect(result.status).toBe(201); return result.body.data; }
async function invoice() {
  const result = await post("/billing/invoices", "billing", { patientId: s.patientId, idempotencyKey: randomUUID(), lines: [{ serviceId: s.serviceId, quantity: 1 }] }); expect(result.status).toBe(201);
  expect((await post(`/billing/invoices/${result.body.data.id}/finalize`, "billing")).status).toBe(201); return result.body.data;
}

beforeAll(async () => {
  for (const role of ["doctor", "reception", "nurse", "billing", "billing-manager", "pharmacy", "radiology", "operations"]) tokens[role] = await login(`${role}@hospital.example`);
  tokens.admin = await login("admin@sunrise.example"); tokens.other = await login("admin@aarogya.example", "aarogya-diagnostics");
  await prisma.workplaces.create({ data: { id: s.workplaceId, tenantId: "TEN-SUNRISE", siteId: "SITE-01", name: "Integration fixture", type: "HOSPITAL", updatedAt: new Date() } });
  await prisma.doctor_workplaces.create({ data: { id: randomUUID(), doctorId: s.doctorId, workplaceId: s.workplaceId, doctorRole: "CONSULTANT", updatedAt: new Date() } });
  await prisma.patients.create({ data: { id: s.patientId, qlynoId: randomUUID(), fullName: "Integration patient", gender: "MALE", phone: "1234567890", updatedAt: new Date(), patient_workplaces: { create: { id: randomUUID(), workplaceId, updatedAt: new Date() } } } });
  await prisma.clinic_services.create({ data: { id: s.serviceId, workplaceId, name: "Consultation", price: "500.00", updatedAt: new Date() } });
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Hospital APIs against PostgreSQL", () => {
  it("requires authentication and isolates tenants and role permissions", async () => {
    await request(app).get("/api/hms/workplaces").expect(401);
    await request(app).get("/api/hms/patients").auth(tokens.other!, { type: "bearer" }).query(w).expect(404);
    await post("/billing/invoices", "nurse", {}).expect(403);
    await post("/prescriptions", "admin", {}).expect(403);
    await post("/patients", "reception", { fullName: "Rejected", gender: "OTHER", phone: "1234567890", tenantId: "other" }).expect(400);
  });
  it("persists receptionist registration for the doctor", async () => {
    const created = await post("/patients", "reception", { fullName: "Shared patient", gender: "FEMALE", phone: "1234567890" }).expect(201);
    const read = await request(app).get(`/api/hms/patients/${created.body.data.id}`).auth(tokens.doctor!, { type: "bearer" }).query(w).expect(200);
    expect(read.body.data.fullName).toBe("Shared patient");
  });
  it("allows only one of two simultaneous bookings for the same doctor", async () => {
    const latest = await prisma.doctor_shifts.findFirst({ where: { doctorId: s.doctorId }, orderBy: { endsAt: "desc" } });
    const startsAt = new Date(Math.max(Date.now() + 86400000, (latest?.endsAt.getTime() ?? 0) + 3600000)); const endsAt = new Date(startsAt.getTime() + 3600000);
    await post("/shifts", "reception", { doctorId: s.doctorId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), shiftType: "CLINIC_OPD" }).expect(201);
    const body = { patientId: s.patientId, doctorId: s.doctorId, scheduledAt: startsAt.toISOString(), durationMinutes: 20 };
    const responses = await Promise.all([post("/appointments", "reception", body), post("/appointments", "reception", body)]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
  });
  it("does not overpay under concurrent requests and replays payments safely", async () => {
    const bill = await invoice();
    const responses = await Promise.all([post(`/billing/invoices/${bill.id}/payments`, "billing", { amount: "350.00", method: "CASH", idempotencyKey: randomUUID() }), post(`/billing/invoices/${bill.id}/payments`, "billing", { amount: "350.00", method: "CASH", idempotencyKey: randomUUID() })]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    const key = randomUUID(); const body = { amount: "150.00", method: "CASH", idempotencyKey: key };
    const first = await post(`/billing/invoices/${bill.id}/payments`, "billing", body).expect(201);
    const replay = await post(`/billing/invoices/${bill.id}/payments`, "billing", body).expect(201);
    expect(first.body.data.id).toBe(replay.body.data.id);
    await post(`/billing/invoices/${bill.id}/payments`, "billing", { ...body, amount: "1.00" }).expect(409);
    expect(await prisma.payment_txns.count({ where: { invoiceId: bill.id } })).toBe(2);
  });
  it("reserves refund balances and requires a separate approver", async () => {
    const bill = await invoice(); await post(`/billing/invoices/${bill.id}/payments`, "billing", { amount: "500.00", method: "CASH", idempotencyKey: randomUUID() }).expect(201);
    const refund = await post(`/billing/invoices/${bill.id}/refunds`, "billing-manager", { amount: "400.00", reason: "Cancelled treatment", idempotencyKey: randomUUID() }).expect(201);
    await post(`/billing/refunds/${refund.body.data.id}/decision`, "billing-manager", { status: "APPROVED", reason: "Self approval is invalid" }).expect(403);
    await post(`/billing/refunds/${refund.body.data.id}/decision`, "admin", { status: "APPROVED", reason: "Refund verified" }).expect(201);
    await post(`/billing/invoices/${bill.id}/refunds`, "billing", { amount: "101.00", reason: "Excessive refund", idempotencyKey: randomUUID() }).expect(409);
    await post(`/billing/refunds/${refund.body.data.id}/complete`, "billing", { reference: "MANUAL-PAYOUT-TEST" }).expect(201);
  });
  it("prevents double bed allocation and requires discharge clearances", async () => {
    const encounter = await visit(); const ward = await post("/wards", "admin", { name: `Ward-${randomUUID()}`, type: "GENERAL" }).expect(201);
    const bed = await post("/beds", "admin", { wardId: ward.body.data.id, code: randomUUID(), dailyRate: "100" }).expect(201);
    const body = { patientId: s.patientId, encounterId: encounter.id, bedId: bed.body.data.id };
    const results = await Promise.all([post("/admissions", "reception", body), post("/admissions", "reception", body)]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const admissionId = results.find(r => r.status === 201)!.body.data.id;
    await post(`/admissions/${admissionId}/discharge`, "reception").expect(409);
    await post(`/admissions/${admissionId}/doctor-clearance`, "doctor", { dischargeSummary: "Discharge approved" }).expect(201);
    await post(`/admissions/${admissionId}/nursing-clearance`, "nurse").expect(201);
    await post(`/admissions/${admissionId}/discharge`, "reception").expect(201);
  });
  it("dispenses only prescribed quantity and replays without decrementing stock again", async () => {
    const encounter = await visit();
    const rx = await post("/prescriptions", "doctor", { patientId: s.patientId, doctorId: s.doctorId, encounterId: encounter.id, medicines: [{ medicineName: "Test Medicine", dose: "1 tablet", frequency: "daily", duration: "5 days", quantity: 5 }] }).expect(201);
    const batch = await post("/pharmacy/batches", "pharmacy", { medicineName: "Test Medicine", batchNumber: randomUUID(), expiresAt: new Date(Date.now() + 86400000).toISOString(), quantity: 10, unitPrice: "2.00" }).expect(201);
    const body = { patientId: s.patientId, prescriptionMedicationId: rx.body.data.prescription_medications[0].id, batchId: batch.body.data.id, quantity: 5, idempotencyKey: randomUUID() };
    await post("/pharmacy/dispenses", "pharmacy", body).expect(201); await post("/pharmacy/dispenses", "pharmacy", body).expect(201);
    await post("/pharmacy/dispenses", "pharmacy", { ...body, quantity: 1, idempotencyKey: randomUUID() }).expect(409);
    expect((await prisma.pharmacyBatch.findUniqueOrThrow({ where: { id: batch.body.data.id } })).quantity).toBe(5);
  });
  it("releases a radiology report atomically and makes it immutable", async () => {
    const encounter = await visit();
    const order = await post("/investigations", "doctor", { patientId: s.patientId, doctorId: s.doctorId, encounterId: encounter.id, title: "Chest X-ray", type: "RADIOLOGY" }).expect(201);
    const study = await post("/radiology/studies", "radiology", { orderId: order.body.data.id, modality: "XRAY" }).expect(201);
    await patch(`/radiology/studies/${study.body.data.id}`, "radiology", { status: "IN_PROGRESS" }).expect(200);
    await patch(`/radiology/studies/${study.body.data.id}`, "radiology", { status: "DRAFT", findings: "Test findings", impression: "Test impression" }).expect(200);
    await patch(`/radiology/studies/${study.body.data.id}`, "radiology", { status: "RELEASED" }).expect(200);
    await patch(`/radiology/studies/${study.body.data.id}`, "radiology", { status: "DRAFT" }).expect(409);
    expect((await prisma.reports.findUniqueOrThrow({ where: { orderId: order.body.data.id } })).resultSummary).toBe("Test findings");
  });
  it("routes a clinical order into the laboratory once and posts one central invoice", async () => {
    const test = await prisma.testCatalogItem.findFirstOrThrow({ where: { tenantId: "TEN-SUNRISE", status: "ACTIVE" } });
    await post("/lab-services", "admin", { testId: test.id, serviceId: s.serviceId }).expect(201);
    const encounter = await visit();
    const order = await post("/investigations", "doctor", { patientId: s.patientId, doctorId: s.doctorId, encounterId: encounter.id, title: test.name, type: "LABORATORY" }).expect(201);
    const body = { testIds: [test.id], collectionLocation: "Collection room" };
    const routed = await post(`/investigations/${order.body.data.id}/send-to-lab`, "doctor", body).expect(201);
    const repeated = await post(`/investigations/${order.body.data.id}/send-to-lab`, "doctor", body).expect(201);
    expect(routed.body.data.id).toBe(repeated.body.data.id);
    const billing = await post(`/billing/laboratory-orders/${order.body.data.id}/invoice`, "billing").expect(201);
    const duplicate = await post(`/billing/laboratory-orders/${order.body.data.id}/invoice`, "billing").expect(201);
    expect(billing.body.data.id).toBe(duplicate.body.data.id);
    expect(billing.body.data.total).toBe("500");
  });
  it("keeps staff conversations private to their participants", async () => {
    const conversation = await post("/conversations", "doctor", { title: "Care handover", participantUserIds: ["USR-HMS-NURSE"] }).expect(201);
    await post(`/conversations/${conversation.body.data.id}/messages`, "doctor", { body: "Patient ready for observation" }).expect(201);
    await request(app).get(`/api/hms/conversations/${conversation.body.data.id}/messages`).auth(tokens.nurse!, { type: "bearer" }).query(w).expect(200);
    await request(app).get(`/api/hms/conversations/${conversation.body.data.id}/messages`).auth(tokens.operations!, { type: "bearer" }).query(w).expect(404);
  });
  it("coordinates ambulance dispatch lifecycle, reroute and reassignment", async () => {
    const primary = await post("/ambulances", "operations", { registrationNumber: `AMB-${randomUUID()}`, type: "ALS", driverName: "Driver One", driverPhone: "+919000000001", equipment: ["Oxygen Tank"], baseLocation: "ER Bay" }).expect(201);
    const replacement = await post("/ambulances", "operations", { registrationNumber: `AMB-${randomUUID()}`, type: "BLS", driverName: "Driver Two", driverPhone: "+919000000002", equipment: ["Spine Board"], baseLocation: "City Bay" }).expect(201);
    const body = { ambulanceId: primary.body.data.id, patientId: s.patientId, pickup: "Bandra West", destination: "Sunrise Emergency", priority: "CRITICAL", notes: "Suspected stroke" };
    const trip = await post("/ambulance-trips", "operations", body).expect(201);
    await post("/ambulance-trips", "operations", body).expect(409);
    await patch(`/ambulance-trips/${trip.body.data.id}/status`, "operations", { status: "EN_ROUTE" }).expect(200);
    await patch(`/ambulance-trips/${trip.body.data.id}/status`, "operations", { status: "AT_SCENE" }).expect(200);
    const rerouted = await post(`/ambulance-trips/${trip.body.data.id}/reroute`, "operations", { destination: "Apex Trauma Institute", reason: "Receiving ICU capacity diversion" }).expect(201);
    expect(rerouted.body.data.status).toBe("RE_ROUTED");
    const reassigned = await post(`/ambulance-trips/${trip.body.data.id}/reassign`, "operations", { newAmbulanceId: replacement.body.data.id, reason: "Primary vehicle equipment failure" }).expect(201);
    expect(reassigned.body.data.ambulanceId).toBe(replacement.body.data.id);
    await patch(`/ambulance-trips/${trip.body.data.id}/status`, "operations", { status: "TRANSPORTING" }).expect(200);
    await patch(`/ambulance-trips/${trip.body.data.id}/status`, "operations", { status: "AT_HOSPITAL" }).expect(200);
    await patch(`/ambulance-trips/${trip.body.data.id}/status`, "operations", { status: "COMPLETED" }).expect(200);
    expect((await prisma.hospitalAmbulance.findUniqueOrThrow({ where: { id: primary.body.data.id } })).status).toBe("MAINTENANCE_OFFLINE");
    expect((await prisma.hospitalAmbulance.findUniqueOrThrow({ where: { id: replacement.body.data.id } })).status).toBe("AVAILABLE");
  });
  it("stores administration resources and hides unpublished content", async () => {
    await request(app).put("/api/hms/profile").auth(tokens.admin!, { type: "bearer" }).send({ ...w, description: "Hospital profile", facilities: ["Emergency"] }).expect(200);
    const content = await post("/content", "admin", { title: "Patient education", kind: "PATIENT_EDUCATION", body: "Follow-up instructions" }).expect(201);
    const draft = await request(app).get("/api/hms/content").auth(tokens.doctor!, { type: "bearer" }).query(w).expect(200);
    expect(draft.body.data).toEqual([]);
    await patch(`/content/${content.body.data.id}`, "admin", { status: "PUBLISHED" }).expect(200);
    const visible = await request(app).get("/api/hms/content").auth(tokens.doctor!, { type: "bearer" }).query(w).expect(200);
    expect(visible.body.data[0].id).toBe(content.body.data.id);
  });
  it("records adapter failure without falsely marking communication delivered", async () => {
    const queued = await post("/communications", "operations", { channel: "EMAIL", recipient: "test@example.invalid", subject: "Follow-up", body: "Test only" }).expect(201);
    await deliverOne(async () => { throw new Error("Provider unavailable"); });
    const failed = await prisma.hospitalOutbox.findUniqueOrThrow({ where: { id: queued.body.data.id } });
    expect(failed.status).toBe("FAILED"); expect(failed.deliveredAt).toBeNull();
    await prisma.hospitalOutbox.update({ where: { id: failed.id }, data: { availableAt: new Date(0) } });
    await deliverOne(async () => {});
    expect((await prisma.hospitalOutbox.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe("DELIVERED");
  });
});

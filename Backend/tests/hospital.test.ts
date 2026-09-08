import { Prisma } from "../src/generated/prisma";
import { calculateInvoice } from "../src/modules/hospital/billing";
import { money, replay, fingerprint, workplaceScope, transition } from "../src/modules/hospital/common";
import { appointmentTransitions, prescriptionInput } from "../src/modules/hospital/clinical";
import { ambulanceTripTransitions } from "../src/modules/hospital/operations";
import { permissionsForRoles } from "../src/config/permissions";
import { openApiDocument } from "../src/docs/openapi";

describe("Hospital domain boundaries", () => {
  it("uses exact decimal arithmetic and refuses excessive discounts", () => {
    expect(calculateInvoice([{ quantity: 3, unitPrice: new Prisma.Decimal("0.10") }]).total.toString()).toBe("0.3");
    expect(() => calculateInvoice([{ quantity: 1, unitPrice: new Prisma.Decimal(100) }], new Prisma.Decimal(101))).toThrow("Discount exceeds");
    expect(money.safeParse(1.001).success).toBe(false);
    expect(money.safeParse("-1").success).toBe(false);
  });
  it("does not turn a reused idempotency key into a different operation", () => {
    const hash = fingerprint({ amount: "1.00" });
    expect(replay({ requestHash: hash }, hash)).toEqual({ requestHash: hash });
    expect(() => replay({ requestHash: hash }, fingerprint({ amount: "2.00" }))).toThrow("different input");
  });
  it("rejects reopening terminal appointments", () => {
    expect(() => transition("COMPLETED", "CHECKED_IN", appointmentTransitions)).toThrow();
    expect(() => transition("CANCELLED", "IN_CONSULTATION", appointmentTransitions)).toThrow();
    expect(() => transition("CHECKED_IN", "IN_CONSULTATION", appointmentTransitions)).not.toThrow();
  });
  it("keeps ambulance dispatches on a forward operational lifecycle", () => {
    expect(() => transition("DISPATCHED", "AT_SCENE", ambulanceTripTransitions)).not.toThrow();
    expect(() => transition("AT_SCENE", "TRANSPORTING", ambulanceTripTransitions)).not.toThrow();
    expect(() => transition("AT_HOSPITAL", "EN_ROUTE", ambulanceTripTransitions)).toThrow();
    expect(() => transition("COMPLETED", "DISPATCHED", ambulanceTripTransitions)).toThrow();
  });
  it("keeps administrative, clinical, dispensing and refund approval separate", () => {
    expect(permissionsForRoles(["tenant_admin"])).not.toContain("hms.clinical.write");
    expect(permissionsForRoles(["hospital_billing"])).not.toContain("hms.billing.approve");
    expect(permissionsForRoles(["hospital_nurse"])).not.toContain("hms.billing.payment");
    expect(permissionsForRoles(["hospital_pharmacist"])).not.toContain("hms.clinical.write");
  });
  it("requires tenant and site scope including deny-all for unassigned staff", () => {
    const context: Parameters<typeof workplaceScope>[0] = { tenantId: "tenant-a", roles: ["hospital_doctor"], siteIds: [], userId: "u", membershipId: "m", status: "ACTIVE", permissions: [], departmentIds: [] };
    expect(workplaceScope(context)).toEqual({ tenantId: "tenant-a", siteId: { in: [] } });
    expect(workplaceScope({ ...context, roles: ["tenant_admin"] })).toEqual({ tenantId: "tenant-a" });
  });
  it("rejects caller-controlled tenant and actor fields", () => {
    expect(prescriptionInput.safeParse({ tenantId: "other", actorUserId: "admin" }).success).toBe(false);
  });
  it("documents typed requests and permission requirements for the hospital routes", () => {
    const entries = Object.entries(openApiDocument.paths).filter(([path]) => path.startsWith("/hms/"));
    expect(entries.length).toBeGreaterThan(60);
    const operation = openApiDocument.paths["/hms/billing/invoices/{id}/payments"]?.post as { requestBody: { content: Record<string, { schema: { required: string[]; additionalProperties: boolean } }> } };
    expect(operation.requestBody.content["application/json"]?.schema.required).toContain("idempotencyKey");
    expect(operation.requestBody.content["application/json"]?.schema.additionalProperties).toBe(false);
  });
});

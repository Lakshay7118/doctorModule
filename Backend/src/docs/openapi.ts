type HttpMethod = "get" | "post" | "patch" | "put" | "delete";
import { hospitalPaths } from "./hospital-openapi";
type RouteDoc = readonly [string, HttpMethod, string, string, boolean?];

import { permissionsForRoles, SYSTEM_ROLES } from "../config/permissions";

const routeDocs: RouteDoc[] = [
  ["/auth/login", "post", "Auth", "Unified login"], ["/auth/register", "post", "Auth", "External account registration"], ["/auth/register/complete-invite", "post", "Auth", "Complete internal staff invitation"], ["/auth/refresh", "post", "Auth", "Rotate refresh token"], ["/auth/forgot-password", "post", "Auth", "Request password reset"], ["/auth/reset-password", "post", "Auth", "Consume password reset token"],
  ["/auth/logout", "post", "Auth", "Sign out this device", true], ["/auth/logout-all", "post", "Auth", "Revoke all sessions", true], ["/users/me", "get", "Users", "Current user and resolved access", true],
  ["/patients", "get", "Patients", "List scoped patients", true], ["/patients", "post", "Patients", "Create patient", true], ["/patients/{id}", "get", "Patients", "Patient detail", true], ["/patients/{id}", "patch", "Patients", "Update patient", true], ["/patients/{id}", "delete", "Patients", "Delete patient", true], ["/encounters", "get", "Patients", "List scoped encounters", true], ["/encounters", "post", "Patients", "Create encounter", true], ["/clients", "get", "Clients", "List client organizations", true], ["/clients/{id}", "get", "Clients", "Client organization detail", true], ["/clients", "post", "Clients", "Create client organization", true], ["/practitioners", "get", "Clients", "List practitioners", true], ["/practitioners", "post", "Clients", "Create practitioner", true],
  ["/catalog", "get", "Catalog", "List active test catalog", true], ["/catalog/{id}", "get", "Catalog", "Catalog item detail", true], ["/catalog", "post", "Catalog", "Create catalog version", true], ["/orders", "get", "Orders", "List scoped orders", true], ["/orders", "post", "Orders", "Place order and generate workflow", true], ["/orders/{id}", "get", "Orders", "Order detail and lifecycle", true], ["/orders/{id}", "patch", "Orders", "Update mutable order fields", true], ["/orders/{id}/charges", "get", "Orders", "Authoritative charge summary", true],
  ["/collection/tasks", "get", "Specimens", "Pending collection tasks", true], ["/collection/tasks/{id}/confirm", "post", "Specimens", "Confirm collection", true], ["/collection/receiving", "get", "Specimens", "Receiving queue", true], ["/collection/receiving/confirm", "post", "Specimens", "Confirm receipt", true], ["/accessioning", "get", "Specimens", "Accessioning queue", true], ["/accessioning/resolve", "post", "Specimens", "Resolve accessioning", true], ["/specimens", "get", "Specimens", "List scoped specimens", true], ["/specimens/{id}", "get", "Specimens", "Specimen detail", true], ["/specimens/{id}/aliquots", "post", "Specimens", "Create aliquot", true], ["/logistics/routes", "get", "Logistics", "Derived courier route board", true], ["/logistics/send-outs", "get", "Logistics", "Reference-lab send-outs", true], ["/logistics/reference-labs", "get", "Logistics", "Reference laboratories", true], ["/logistics/manifests", "get", "Logistics", "List manifests", true], ["/logistics/manifests/{id}", "get", "Logistics", "Manifest detail", true], ["/logistics/manifests", "post", "Logistics", "Create transit manifest", true], ["/logistics/manifests/{id}/status", "post", "Logistics", "Advance manifest status", true],
  ["/workbench", "get", "Workbench", "List work items", true], ["/workbench/analyzers", "get", "Workbench", "Analyzer status", true], ["/workbench/analyzers/{id}", "get", "Workbench", "Analyzer detail and run history", true], ["/workbench/runs", "get", "Workbench", "Instrument runs", true], ["/workbench/runs", "post", "Workbench", "Start instrument run", true], ["/results", "get", "Results", "List results", true], ["/results/validation", "get", "Results", "Validation queue", true], ["/results", "post", "Results", "Enter or revise result", true], ["/results/critical", "get", "Results", "Critical notifications", true], ["/results/critical/{id}/acknowledge", "post", "Results", "Acknowledge critical result", true], ["/results/{id}/technical-review", "post", "Results", "Technical review", true], ["/results/{id}/medical-validation", "post", "Results", "Medical validation", true], ["/reports", "get", "Reports", "Scoped reports and amendments", true], ["/reports/{orderId}", "get", "Reports", "Report versions", true], ["/reports/{orderId}/versions", "post", "Reports", "Release immutable report version", true], ["/reports/{orderId}/delivery", "post", "Reports", "Deliver report and close order", true], ["/reports/versions/{id}", "patch", "Reports", "Edit unreleased draft", true],
  ["/quality/qc", "get", "Quality", "QC runs", true], ["/quality/qc/{id}", "get", "Quality", "QC run detail", true], ["/quality/qc", "post", "Quality", "Create QC run", true], ["/quality/qc/{id}/override", "post", "Quality", "Audited QC override", true], ["/quality/nonconformances", "get", "Quality", "Nonconformances", true], ["/quality/nonconformances", "post", "Quality", "Create nonconformance", true], ["/quality/nonconformances/{id}/capas", "post", "Quality", "Create CAPA", true], ["/quality/capas", "get", "Quality", "CAPA board", true], ["/quality/documents", "get", "Quality", "Quality documents", true], ["/quality/documents", "post", "Quality", "Create quality document", true], ["/quality/audits", "get", "Quality", "Quality audits", true], ["/quality/audits", "post", "Quality", "Create quality audit", true], ["/quality/competency", "get", "Quality", "Competency assessments", true], ["/quality/competency", "post", "Quality", "Record competency", true],
  ["/inventory/items", "get", "Inventory", "Inventory items", true], ["/inventory/items", "post", "Inventory", "Create inventory item", true], ["/inventory/lots", "get", "Inventory", "Stock lots", true], ["/inventory/lots", "post", "Inventory", "Create stock lot", true], ["/inventory/movements", "get", "Inventory", "Stock movement history", true], ["/inventory/movements", "post", "Inventory", "Record stock movement", true], ["/inventory/purchase-orders", "get", "Inventory", "List purchase orders", true], ["/inventory/purchase-orders", "post", "Inventory", "Create purchase order", true], ["/inventory/equipment", "get", "Inventory", "Equipment and maintenance", true], ["/inventory/equipment/{id}", "get", "Inventory", "Equipment detail", true], ["/inventory/equipment/maintenance", "get", "Inventory", "Maintenance schedule", true], ["/inventory/equipment", "post", "Inventory", "Create equipment", true], ["/inventory/equipment/{id}/maintenance", "post", "Inventory", "Schedule maintenance", true], ["/billing/summary", "get", "Billing", "Commercial dashboard totals", true], ["/billing/invoices", "get", "Billing", "Scoped invoices", true], ["/billing/invoices/{id}", "get", "Billing", "Invoice detail", true], ["/billing/invoices", "post", "Billing", "Create LIS invoice", true], ["/billing/estimates", "get", "Billing", "Scoped estimates", true], ["/billing/estimates", "post", "Billing", "Create estimate", true], ["/billing/payments", "get", "Billing", "Payment history", true], ["/billing/refunds", "get", "Billing", "Refund history", true], ["/billing/invoices/{id}/payments", "post", "Billing", "Record payment", true], ["/billing/invoices/{id}/refunds", "post", "Billing", "Request refund", true], ["/billing/contracts", "get", "Billing", "Scoped contracts", true], ["/billing/contracts", "post", "Billing", "Create contract", true],
  ["/communications/templates", "get", "Communications", "Templates and delivery history", true], ["/communications/templates", "post", "Communications", "Create template", true], ["/communications/history", "get", "Communications", "Delivery history", true], ["/communications/portal-access", "get", "Communications", "External portal accounts", true], ["/communications/send", "post", "Communications", "Queue a communication", true], ["/integrations", "get", "Integrations", "Connection status", true], ["/integrations", "post", "Integrations", "Upsert connection", true], ["/integrations/{id}/test", "post", "Integrations", "Record connector test", true], ["/dashboard", "get", "Dashboard", "Live command-center metrics", true], ["/analytics/summary", "get", "Analytics", "Operational summary", true], ["/queues", "get", "Queues", "Queue counters", true], ["/queues/{type}", "get", "Queues", "Derived queue detail", true], ["/scheduling", "get", "Orders", "Collection schedule", true],
  ["/admin/users", "get", "Administration", "Tenant users", true], ["/admin/users/invite", "post", "Administration", "Invite internal staff", true], ["/admin/approvals", "get", "Administration", "Pending approvals", true], ["/admin/approvals/{id}/approve", "post", "Administration", "Approve registration", true], ["/admin/approvals/{id}/reject", "post", "Administration", "Reject registration", true], ["/admin/audit", "get", "Administration", "Audit events", true], ["/admin/sites", "get", "Administration", "Sites and departments", true], ["/admin/sites", "post", "Administration", "Create site", true], ["/admin/departments", "post", "Administration", "Create department", true], ["/admin/roles", "get", "Administration", "Role permission matrix", true], ["/admin/users/{id}/status", "patch", "Administration", "Change account status", true], ["/admin/users/{id}/access", "put", "Administration", "Change roles and scopes", true],
  ["/support", "get", "Support", "Scoped support tickets", true], ["/support", "post", "Support", "Create support ticket", true], ["/support/{id}", "patch", "Support", "Resolve support ticket", true], ["/settings", "get", "Settings", "Tenant and site settings", true], ["/settings", "patch", "Settings", "Update tenant settings", true]
];

function requiredPermissions(path: string, method: HttpMethod, tag: string): string[] {
  if (path.startsWith("/auth/")) return [];
  if (path === "/users/me") return [];
  if (path.startsWith("/admin/approvals")) return ["admin.approvals"];
  if (path.startsWith("/admin/roles")) return ["admin.roles"];
  if (path.startsWith("/admin/audit")) return ["audit.read"];
  if (path.startsWith("/admin/")) return ["admin.users"];
  if (path.includes("collection/tasks/") && method === "post") return ["collection.confirm"];
  if (path.includes("receiving/confirm")) return ["specimen.receive"];
  if (path.includes("accessioning/resolve") || path.includes("aliquots")) return ["specimen.accession"];
  if (path.includes("medical-validation")) return ["results.medical_validate"];
  if (path.includes("technical-review")) return ["results.technical_review"];
  if (path.includes("critical/") && method === "post") return ["results.technical_review", "results.medical_validate"];
  if (tag === "Reports" && method !== "get") return ["reports.release"];
  if (path.includes("qc/") && path.endsWith("override")) return ["quality.override"];
  if (tag === "Quality") return [method === "get" ? "quality.read" : "quality.write"];
  if (tag === "Inventory") return [method === "get" ? "inventory.read" : path.includes("equipment") ? "equipment.write" : "inventory.write"];
  if (tag === "Billing") { if (method === "get") return ["billing.read", "billing.read.client"]; if (path.endsWith("/payments")) return ["billing.payment"]; if (path.endsWith("/refunds")) return ["billing.refund"]; if (path.endsWith("/contracts")) return ["billing.contracts"]; if (path.endsWith("/estimates")) return ["billing.estimate"]; return ["billing.invoice"]; }
  if (tag === "Communications") return [method === "get" ? "communications.read" : path.endsWith("/send") ? "communications.send" : "communications.write"];
  if (tag === "Integrations") return ["integrations.manage"];
  if (tag === "Logistics") return [method === "get" ? "logistics.read" : "logistics.write"];
  if (tag === "Workbench") return [method === "get" ? "results.read" : "workbench.write"];
  if (tag === "Results") return [method === "get" ? "results.read" : "results.write"];
  if (tag === "Specimens") return ["specimens.read"];
  if (tag === "Patients") return [method === "get" ? "patients.read" : "patients.write"];
  if (tag === "Orders") return [method === "get" ? "orders.read" : "orders.write"];
  if (tag === "Catalog") return [method === "get" ? "orders.read" : "admin.roles"];
  if (tag === "Dashboard") return ["dashboard.read"];
  if (tag === "Analytics") return ["analytics.read", "dashboard.read"];
  if (tag === "Queues") return ["dashboard.read", "orders.read"];
  if (tag === "Support") return [method === "patch" ? "admin.users" : "dashboard.read"];
  if (tag === "Settings") return [method === "get" ? "dashboard.read" : "admin.users"];
  return [];
}

const paths: Record<string, Record<string, unknown>> = {
  "/health": { get: { summary: "Uptime probe", responses: { "200": { description: "Healthy" } } } }
};
for (const [path, method, tag, summary, secure] of routeDocs) {
  const permissions = requiredPermissions(path, method, tag);
  const roles = secure && permissions.length ? SYSTEM_ROLES.filter((role) => permissions.some((permission) => permissionsForRoles([role]).includes(permission))) : secure ? [...SYSTEM_ROLES] : [];
  paths[path] ??= {};
  paths[path]![method] = {
    tags: [tag], summary, ...(secure ? { security: [{ bearerAuth: [] }] } : {}),
    ...(secure ? { "x-required-permissions": permissions, "x-required-roles": roles } : {}),
    ...(method === "get" ? {} : { requestBody: { content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } }),
    responses: { "200": { description: "Success" }, "201": { description: "Created" }, "400": { description: "Validation error" }, "401": { description: "Unauthenticated" }, "403": { description: "Insufficient permissions" } }
  };
}

export const openApiDocument = {
  openapi: "3.0.3",
  info: { title: "Qlyno HMS Laboratory Portal API", version: "1.0.0", description: "Multi-tenant laboratory operations API. Tenant and access scope are derived from verified tokens." },
  servers: [{ url: "/api" }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }, refreshCookie: { type: "apiKey", in: "cookie", name: "qlyno_refresh" } } },
  paths: { ...paths, ...hospitalPaths() }
};

# Qlyno project review and build plan

Reviewed: 7 September 2026. This assessment concerns the current working tree, including existing uncommitted frontend changes.

## Verdict

Qlyno has extensive frontend implementation and a substantial laboratory API. It is not yet a completed, integrated hospital management system. Continue the existing backend rather than restarting it. Prioritize reliable shared workflows over additional screens.

The frontend contains 400 Next.js page files and 782 files under src. Hospital administration accounts for 243 pages, doctor for 21, receptionist for 16, billing staff for 25, and clinic operations for 6. Remaining routes largely cover laboratory operations and public discovery/booking. Page counts measure surface area, not completion.

Backend/src/modules contains 20 route files covering multiple mounted API groups. Prisma declares 114 models, including both laboratory models and older HMS models. A database model does not mean that its API or frontend integration exists.

## Scope and evidence limits

Reviewed route inventories, frontend state/data architecture, representative screens and actions, API client contracts, server route mounts, authentication, database schema/migrations, backend tests, and the available patient-journey text. This is a source and automated-check assessment, not a claim that every button on 400 pages has been manually tested.

The extracted HMS Business Requirements Document.txt and HMS Patient Journey - Developer User Flow.txt are empty. Their original PDFs were not reviewed in this pass. Qlyno_Patient_Journey.txt was available and reviewed. Consequently, exact compliance with every original requirement remains unverified.

No live database migration, seed, external integration, or browser end-to-end journey was executed. Environment secret values were not inspected. Existing application source changes were preserved.

## Product understanding

Qlyno combines hospital operations, doctor/clinic workspaces, reception, nursing, billing and laboratory operations. Public discovery and booking extend the staff system toward patient-facing care.

The patient journey describes discovery, appointment booking, registration, OPD consultation, prescriptions, diagnostics, medication fulfillment and follow-up. It also includes online consultation, emergency/ambulance coordination, admission, government-scheme eligibility, beds, nursing, surgery and discharge.

These journeys need shared patient, encounter, practitioner, organization and billing references. Today, multiple frontend stores and two database model families represent overlapping parts of that journey independently.

## Frontend module status

Status describes implementation evidence, not visual acceptance testing. None of the groups below is certified complete end to end.

| Module | Existing implementation | Completion gap |
| --- | --- | --- |
| Sign-in and role access | Unified role selection and demo laboratory session | Real login, refresh, logout, server-derived role/scope and protected data loading |
| Doctor | Dashboard, patients/chart, queue, appointments, consultation, EMR, vitals, prescriptions, diagnosis, lab/radiology orders, follow-up, alerts, tasks, duty, communication and reports | API client targets numerous absent HMS routes; mock fallback masks failures; clinical persistence and cross-role handoff unverified |
| Clinic | Doctors, staff, schedules, services, locations and dashboard | Corresponding /api/clinic and shift APIs are not mounted in current server |
| Receptionist | Registration, directory, appointments, check-in, OPD, IPD admission, emergency, visitors, billing coordination, communication and reports | Partial API attempts depend on absent bootstrap/state/appointment routes; queue/admission/visitor workflows need domain APIs |
| Hospital admin | Broad command, staffing, beds, emergency, surgery, diagnostics, pharmacy, procurement, documents, analytics and settings surfaces | Redux/mock-driven features need persisted operations and shared records; page presence does not establish feature completeness |
| Nursing | Role gates, nursing operations, station/roster and bedside-related surfaces within hospital admin | Browser storage/Redux is not shared clinical persistence; need assignments, observations, administration records and handover APIs |
| Billing staff | Invoices, receipts, payments, discounts, refunds, insurance, settlement and reconciliation UI | AppContext initializes from mocks and applies local reducer actions; central hospital billing backend is not supplied by LIS invoice APIs |
| Laboratory | Orders, collection, specimens, accessioning, processing, results, validation, reports, quality, inventory, logistics and admin surfaces | Existing backend is the strongest foundation, but UI sessions/workflow remain demo/local; wire actual APIs and verify complete lifecycle |
| Pharmacy | Admin prescription, dispensing, stock, expiry, returns, supplier/staff views | Dedicated dispensing and stock reservation workflows, persisted fulfillment, charge integration and tests |
| Radiology | Imaging queue, scheduling, reports, critical findings, viewer and equipment views | Imaging workflow APIs, actual asset/viewer integration and report authorization |
| Emergency, ambulance, IPD, OT | Substantial admin UI and state slices | Server transitions, concurrent bed/room allocation, transport events, surgery coordination and discharge dependencies |
| Public discovery and booking | discover/book/doctors/clinics surfaces | Real searchable availability, booking conflict prevention, patient identity and booking confirmation |
| Patient self-service and teleconsultation | Journey requirement and related frontend concepts | Complete authenticated patient journey, actual call/session infrastructure, report access and follow-up delivery are not established by this review |
| Communication and integrations | Local communication surfaces and backend event/configuration routes | Durable delivery workers, retries, provider acknowledgements and real external adapters |

## Confirmed integration blockers

1. **Frontend login is a demo.** Frontend/src/app/sign-in/page.tsx sends non-laboratory roles to their portal after a nonempty password check. Laboratory login uses DemoProvider/authenticateDemo. This does not establish backend identity.
2. **The shared API client does not supply backend authentication.** Frontend/src/lib/api-client.ts requestJson sends credentials: include but no Authorization bearer token. Backend/src/middleware/authenticate.ts requires that header. A refresh cookie alone does not satisfy it.
3. **HMS client endpoints are missing from the running source server.** The client requests /api/bootstrap, /api/appointments, /api/shifts, /api/prescriptions, /api/clinic/*, /api/diagnoses, /api/follow-ups, /api/notifications, /api/conversations, /api/vitals and /api/state. Backend/src/app.ts does not mount these route groups. Do not rely on stale dist output to restore them.
4. **Some endpoint names overlap but mean different things.** The doctor createBackendOrder sends an investigation-order payload to /api/orders, which currently validates laboratory-order inputs. completeBackendEncounter sends clinical encounter fields to the laboratory encounter endpoint. These need explicit contracts, not just matching URL names.
5. **API failures can look like working screens.** DoctorWorkflowProvider falls back to seed data when loading fails and swallows saveBackendState errors. Production should show failures and distinguish unpersisted edits.
6. **Shared records are fragmented.** Prisma includes Patient/patients, Encounter/encounters, User/user_accounts, Report/reports and laboratory/HMS billing families. Define ownership and mappings before adding more patient or encounter tables. Do not delete or merge existing tables without a data migration plan.
7. **Health contract differs.** The client expects ok/database fields, while the server returns status: ok. The current endpoint does not verify database readiness.
8. **Time conversion needs a deliberate rule.** toIsoDateTime attaches Z to entered 12-hour wall-clock values and other formatting uses UTC. Define workplace time zones and test local-to-UTC conversion before booking and duty schedules depend on it.

## Existing backend to retain

- Express/TypeScript, PostgreSQL and Prisma with a custom generated client.
- Authentication service, invitations, account approval, password hashing, token/session lifecycle and rate limiting.
- Protected routers, permissions, tenant context, site/ownership filters and audit services.
- Laboratory catalog, patients/encounters, orders, collection, accessioning, specimens, workbench, results/report versions and lifecycle services.
- LIS billing authority logic, invoices/payments/refunds, quality, inventory, logistics, communication records, integration configuration, dashboards, operational queues, support and settings.
- OpenAPI route metadata and tests.

This is useful implementation, but the backend README's production-oriented wording should not be treated as proof of production readiness or full frontend coverage.

## Backend issues to address before pilot use

- Billing summary scopes invoices to a client organization for client users, but payment/refund aggregate queries in that same handler use only tenantId. Review and test that client users cannot see other clients' aggregate amounts.
- Payment and refund handlers compute remaining balances before the write operation. Concurrent requests can pass the same balance check. Add atomic concurrency control and duplicate-request protection, then test concurrent payments/refunds.
- Invoice duplicate detection is a read-before-create check. Verify database constraints and transactional behavior under concurrent requests.
- Money totals use JavaScript number arithmetic before persistence. Use a consistent exact-money representation and rounding policy.
- Integration connectivity tests explicitly record SIMULATED events. They do not test a live external service.
- Report delivery records DELIVERED/ACKNOWLEDGED and closes the order without executing an external delivery adapter in that handler. Distinguish queued delivery, actual provider success, manual handover and acknowledgement.
- Existing schema tenant checks explicitly exclude the older HMS model family. Their passing result does not demonstrate HMS workplace/tenant isolation.
- Some audit calls occur after data writes; define which actions require audit and mutation to commit atomically.

These are source-level findings and risks; no live exploitation or concurrency experiment was performed.

## Recommended architecture

Continue as a modular backend application. Use clear domain modules, a shared database boundary, and a background worker for external delivery. The existing stack is sufficient for the next implementation stage.

Within each domain, separate routes, request schemas, service/business operations and persistence as complexity requires. Keep permissions and tenant scope at every data boundary. Avoid copying frontend reducers directly into generic JSON-state endpoints for clinical or billing records.

Define a canonical organization/workplace/site relationship and membership model. Choose a patient master strategy, keep explicit laboratory links if separate records are necessary, and establish one traceable encounter-to-order-to-charge chain.

Publish explicit versioned API contracts. A possible naming scheme is /api/v1/clinical, /api/v1/laboratory, /api/v1/billing and /api/v1/operations, with shared identity endpoints. This is a proposal, not an existing API. Migrate callers incrementally rather than renaming everything at once.

Keep demo data behind an explicit demo mode. Normal operation must use authenticated backend data, visible loading/errors, server validation and cache refresh after successful mutations. A saved indicator should only appear after persistence succeeds.

## Implementation sequence and acceptance gates

### Phase 0: establish a reliable baseline

1. Fix current frontend lint errors and record typecheck/test results in CI.
2. Update the root README: its frontend-only description and root commands are stale.
3. Produce a screen/action-to-endpoint contract list; mark missing routes and incompatible payloads.
4. Document the two model families, identity ownership and organization/workplace mappings.
5. Rehearse the existing migration chain against a disposable empty database and a disposable copy of the older HMS baseline. Verify data preservation; never reset an existing database as a shortcut.
6. Add database readiness separately from process liveness.

Gate: repeatable local setup, clear migration path, known API contract and passing code checks.

### Phase 1: real authentication and shared master data

1. Connect login to existing auth APIs; implement access-token use, refresh rotation, logout and expired-session handling.
2. Add server-authorized hospital roles/memberships where the laboratory role model is insufficient.
3. Load user/permissions/sites from the server before protected queries run.
4. Implement shared patient lookup/registration with tenant-local identifiers and duplicate handling.
5. Expose practitioners, departments, locations, service catalog and workplace membership needed by reception/doctor screens.

Gate: two users in the same authorized organization see the same persisted patient; another tenant cannot access it, even by guessing an ID. Refresh/logout and direct-route access behave correctly.

### Phase 2: one complete OPD workflow

1. Implement schedules/availability, appointments and atomic booking conflict prevention.
2. Implement check-in, queue tokens and encounter transitions.
3. Implement clinical notes, vitals, diagnoses, structured prescriptions and follow-up scheduling.
4. Connect receptionist and doctor screens to these APIs and remove normal-mode fallback mocks.
5. Replace generic workspace snapshots with explicit operations for queue/tasks/encounters.

Gate: receptionist registers and books a patient; doctor opens the same encounter, records consultation and prescription; results survive reload and a second authorized session.

### Phase 3: connect the existing laboratory workflow

1. Map the clinical investigation request into a laboratory order with preserved patient/encounter references.
2. Connect order list/detail, collection, receiving, accessioning, workbench, result entry, review and release screens.
3. Return report status/results to the originating doctor encounter.
4. Cover rejection/recollection, partial specimens, critical results and amendments.
5. Preserve HMS central versus LIS billing authority and deduplicate posting requests.

Gate: doctor orders a test, the laboratory processes it using separate authorized roles, and the doctor sees the released report. Unauthorized release is denied; released versions remain immutable.

### Phase 4: central hospital billing

1. Build service charges linked to clinical encounters/orders and a central hospital invoice model/API.
2. Connect the billing-staff portal to invoices, payments, receipts, discounts and refund approvals.
3. Make payment/refund balance changes atomic and requests idempotent.
4. Add reconciliation and scoped audit/history.
5. Add insurance claims/TPA and discharge settlement after core charging/payment flow works.

Gate: a laboratory service creates exactly one appropriate charge, payment retries do not duplicate receipts, simultaneous payments cannot overpay, and balances agree across portals.

### Phase 5: inpatient operations and fulfillment

Build in dependency order: admission and bed allocation -> nursing assignments/observations/handover -> medication fulfillment and stock -> surgery/OT scheduling -> discharge coordination. Connect emergency/ambulance and radiology workflows to the same patient/encounter model.

Gate: concurrent staff cannot allocate the same bed/OT slot, nursing and doctor views agree, and discharge prerequisites have traceable sign-offs.

### Phase 6: external services and patient journey completion

Implement actual communication delivery with a durable job/outbox mechanism, retries and acknowledgements. Add protected document storage and report downloads. Then complete patient self-service, real discovery/availability, teleconsultation, home collection/fulfillment and external payment/insurance/imaging/analyzer adapters according to the pilot scope.

Gate: delivered means confirmed delivery or explicitly recorded manual handover; retries and provider failures remain visible and do not duplicate business actions.

### Phase 7: pilot readiness

Add database-backed integration tests and browser tests for the accepted journeys. Verify backups by restoring one, enforce deployment configuration, measure realistic queue/search performance and complete accessibility/responsive acceptance testing. Define monitoring for failed jobs, authentication failures and workflow stalls.

Gate: a representative pilot organization can complete the agreed journeys without demo data, unexplained loss of changes or privileged-role workarounds.

## What to build immediately

The next concrete milestone should be **authenticated patient registration shared between receptionist and doctor**. First resolve patient identity and tenant/workplace mapping, wire real login into the API client, then make patient creation/list/detail persist and appear in both portals. This proves the foundation before expanding to appointments, clinical notes and lab orders.

In parallel within ordinary development work, fix the lint backlog and document API mismatches. Defer extra analytics screens, AI assistant expansions and broad integrations until core records and workflows are dependable.

## Definition of a completed frontend module

All required screens and actions exist; real authentication and server authorization apply; data persists across reload and authorized sessions; validation/loading/empty/error states work; failed mutations are visible; cross-module handoffs use shared IDs; responsive/accessibility acceptance is recorded; and meaningful integration/browser tests pass. A rendered table and a success toast do not meet this gate.

## Verification performed

- Backend typecheck: passed.
- Backend tests: 5 suites, 29 tests passed. They cover contracts, authentication with mocked Prisma, billing authority, RBAC and scope behavior; they are not a full live-database hospital workflow suite.
- Frontend lint: failed with 30 unescaped-entity errors and 5 warnings. Most errors are JSX apostrophes/quotation marks in hospital-admin pages/components; warnings include image optimization and hook dependencies.
- Frontend Next configuration sets eslint.ignoreDuringBuilds to true, so a successful build would not imply lint passes.
- Frontend standalone TypeScript check: passed using the installed Frontend TypeScript compiler with --noEmit --incremental false.
- Full production build, browser journey validation, migration replay and external delivery verification were not run.

## Key source references

- Frontend/src/app/sign-in/page.tsx
- Frontend/src/state/demo-context.tsx
- Frontend/src/lib/api-client.ts
- Frontend/src/lib/doctor-workflow-context.tsx
- Frontend/src/components/receptionist/data-context.tsx
- Frontend/src/state/hospital-workflow-context.tsx
- Frontend/src/billing-staff/context/AppContext.tsx
- Frontend/src/hospital-admin/store/store.ts
- Frontend/src/hospital-admin/store/provider.tsx
- Frontend/next.config.mjs
- Backend/src/app.ts
- Backend/src/middleware/authenticate.ts
- Backend/src/modules/patients/routes.ts
- Backend/src/modules/orders/routes.ts
- Backend/src/modules/billing/routes.ts
- Backend/src/modules/results/routes.ts
- Backend/src/modules/integrations/routes.ts
- Backend/prisma/schema.prisma
- Backend/prisma/migrations/
- Backend/tests/contract.test.ts
- Backend/docs/FRONTEND_API_COVERAGE.md (an intended mapping; not evidence that frontend callers are connected)
- drive-docs/Qlyno_Patient_Journey.txt

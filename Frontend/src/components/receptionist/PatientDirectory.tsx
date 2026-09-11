"use client";

import * as React from "react";
import { CheckCircle2, Eye, Pencil, Search, UserPlus, UserX } from "lucide-react";
import { getBackendReceptionistPatientDetails, type BackendReceptionistPatientDetails } from "@/lib/api-client";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Mono, SectionHeader, Select, Table, Textarea } from "./ui";
import { useReceptionistData } from "./data-context";
import { formatReceptionistDate, todayIso } from "./date-utils";

const statusTone: Record<string, "pine" | "amber" | "slate" | "coral"> = {
  Active: "pine",
  New: "amber",
  Discharged: "slate",
  Deactivated: "coral",
};

type PatientFormValues = {
  name: string;
  age: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  department: string;
  bloodGroup: string;
  notes: string;
};

export function PatientDirectory() {
  const { addPatient, deactivatePatient, doctors, patients, updatePatient } = useReceptionistData();
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("All");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [lastRegistered, setLastRegistered] = React.useState<null | { uhid: string; name: string }>(null);
  const [saveError, setSaveError] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState("");
  const [selectedDetails, setSelectedDetails] = React.useState<BackendReceptionistPatientDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const departmentOptions = React.useMemo(() => {
    const names = Array.from(new Set([...doctors.map((doctor) => doctor.department), ...patients.map((patient) => patient.department)].filter(Boolean)));
    return names.length > 0 ? names : ["General Medicine"];
  }, [doctors, patients]);
  const [form, setForm] = React.useState<PatientFormValues>({
    name: "",
    age: "",
    gender: "Male",
    phone: "",
    email: "",
    address: "",
    department: departmentOptions[0],
    bloodGroup: "",
    notes: "",
  });
  const [editForm, setEditForm] = React.useState<PatientFormValues>({
    name: "",
    age: "",
    gender: "Male",
    phone: "",
    email: "",
    address: "",
    department: departmentOptions[0],
    bloodGroup: "",
    notes: "",
  });

  React.useEffect(() => {
    setForm((current) => (departmentOptions.includes(current.department) ? current : { ...current, department: departmentOptions[0] }));
  }, [departmentOptions]);

  const filtered = patients.filter((p) => {
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.uhid.toLowerCase().includes(query.toLowerCase()) ||
      p.phone.includes(query);
    const matchesDept = dept === "All" || p.department === dept;
    return matchesQuery && matchesDept;
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm({
      name: "",
      age: "",
      gender: "Male",
      phone: "",
      email: "",
      address: "",
      department: departmentOptions[0],
      bloodGroup: "",
      notes: "",
    });
  }

  function updateEdit<K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  function populateEditForm(details: BackendReceptionistPatientDetails) {
    setEditForm({
      name: details.name,
      age: details.age ? String(details.age) : "",
      gender: details.gender,
      phone: details.phone,
      email: details.email,
      address: details.address,
      department: details.department,
      bloodGroup: details.bloodGroup,
      notes: details.notes,
    });
  }

  async function openPatientDetails(patient: (typeof patients)[number], mode: "view" | "edit") {
    if (!patient.backendId) {
      setActionMessage("This patient is not linked to a saved backend record.");
      return;
    }

    setDetailsLoading(true);
    setSaveError("");
    try {
      const details = await getBackendReceptionistPatientDetails(patient.backendId, patient.workplaceId);
      setSelectedDetails(details);
      if (mode === "edit") {
        populateEditForm(details);
        setEditOpen(true);
      } else {
        setDetailsOpen(true);
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Patient details could not be loaded from the backend.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleEditPatient(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedDetails || !editForm.name || !editForm.phone || !editForm.age || actionLoading) return;

    setActionLoading(true);
    setSaveError("");
    try {
      const age = Number(editForm.age);
      const year = new Date().getFullYear() - age;
      await updatePatient(selectedDetails.id, {
        fullName: editForm.name,
        gender: editForm.gender as "Male" | "Female" | "Other",
        dateOfBirth: Number.isFinite(age) ? `${year}-01-01` : null,
        phone: editForm.phone,
        email: editForm.email,
        bloodGroup: editForm.bloodGroup,
        department: editForm.department,
        address: editForm.address,
        notes: editForm.notes,
        workplaceId: selectedDetails.workplaceId,
      });
      setEditOpen(false);
      setActionMessage(`${editForm.name}'s details were updated successfully.`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Patient details could not be updated.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeactivatePatient() {
    if (!selectedDetails || actionLoading) return;
    setActionLoading(true);
    setSaveError("");
    try {
      await deactivatePatient(selectedDetails.id, selectedDetails.workplaceId);
      setDeactivateOpen(false);
      setDetailsOpen(false);
      setActionMessage(`${selectedDetails.name} was deactivated from this patient directory.`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Patient could not be deactivated.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name || !form.age || !form.phone || isSaving) return;
    setSaveError("");
    setIsSaving(true);

    try {
      const patient = await addPatient({
        name: form.name,
        age: Number(form.age),
        gender: form.gender as any,
        phone: form.phone,
        email: form.email || undefined,
        department: form.department,
        bloodGroup: form.bloodGroup || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        lastVisit: formatReceptionistDate(todayIso()),
        status: "New",
      });

      setLastRegistered({ uhid: patient.uhid, name: patient.name });
      setQuery("");
      setDept("All");
      resetForm();
      setModalOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Patient could not be saved to the backend database.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - Patients"
        title="Patients"
        description="View all registered patients and add new patients from the same workspace."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <UserPlus size={16} /> Register Patient
          </Button>
        }
      />

      <Modal open={modalOpen} title="Register Patient" eyebrow="Front Desk" onClose={() => setModalOpen(false)} size="xl">
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="rp-grid-2">
            <Field label="Full name" required>
              <Input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Full patient name" required />
            </Field>
            <Field label="Phone number" required>
              <Input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="98765 43210" required />
            </Field>
          </div>

          <div className="rp-grid-3">
            <Field label="Age" required>
              <Input type="number" min={0} value={form.age} onChange={(event) => update("age", event.target.value)} placeholder="Years" required />
            </Field>
            <Field label="Gender" required>
              <Select value={form.gender} onChange={(event) => update("gender", event.target.value)}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field label="Blood group">
              <Select value={form.bloodGroup} onChange={(event) => update("bloodGroup", event.target.value)}>
                <option value="">Unknown</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bloodGroup) => (
                  <option key={bloodGroup}>{bloodGroup}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Email" hint="Optional - used for appointment confirmations">
            <Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="name@example.com" />
          </Field>

          <Field label="Address">
            <Textarea rows={2} value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="Street, city, pin code" />
          </Field>

          <Field label="Department to visit" required>
            <Select value={form.department} onChange={(event) => update("department", event.target.value)}>
              {departmentOptions.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </Select>
          </Field>

          <Field label="Notes for the doctor" hint="Allergies, ongoing medication, referral details">
            <Textarea rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional" />
          </Field>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" disabled={isSaving}>
              <UserPlus size={16} /> {isSaving ? "Saving..." : "Register patient"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <span className="text-xs text-ink-muted">A UHID is generated after saving.</span>
          </div>
          {saveError && <p role="alert" className="rounded-md border border-alert-100 bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">{saveError}</p>}
        </form>
      </Modal>

      <Modal open={detailsOpen} title="Patient details" eyebrow="Patient directory" onClose={() => setDetailsOpen(false)} size="lg">
        {detailsLoading ? (
          <p className="text-sm text-ink-muted">Loading patient details...</p>
        ) : selectedDetails ? (
          <div>
            <div className="mb-5 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="eyebrow mb-1">{selectedDetails.uhid}</p>
                <h2 className="font-display text-2xl text-ink">{selectedDetails.name}</h2>
                <p className="mt-1 text-sm text-ink-muted">Registered {formatReceptionistDate(selectedDetails.createdAt.slice(0, 10))}</p>
              </div>
              <Badge tone={statusTone[selectedDetails.status]}>{selectedDetails.status}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><p className="eyebrow">Age / gender</p><p className="text-sm font-semibold text-ink">{selectedDetails.age} / {selectedDetails.gender}</p></div>
              <div><p className="eyebrow">Phone</p><p className="text-sm font-semibold text-ink">{selectedDetails.phone || "Not added"}</p></div>
              <div><p className="eyebrow">Email</p><p className="text-sm font-semibold text-ink">{selectedDetails.email || "Not added"}</p></div>
              <div><p className="eyebrow">Blood group</p><p className="text-sm font-semibold text-ink">{selectedDetails.bloodGroup || "Not recorded"}</p></div>
              <div><p className="eyebrow">Department</p><p className="text-sm font-semibold text-ink">{selectedDetails.department}</p></div>
              <div><p className="eyebrow">Address</p><p className="text-sm font-semibold text-ink">{selectedDetails.address || "Not added"}</p></div>
            </div>
            <div className="mt-5 border-t border-line pt-4"><p className="eyebrow">Reception notes</p><p className="whitespace-pre-wrap text-sm text-ink">{selectedDetails.notes || "No reception notes"}</p></div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => { setDetailsOpen(false); populateEditForm(selectedDetails); setEditOpen(true); }}>
                <Pencil size={16} /> Edit patient
              </Button>
              {selectedDetails.status === "Active" && (
                <Button variant="danger" onClick={() => setDeactivateOpen(true)}>
                  <UserX size={16} /> Deactivate
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDetailsOpen(false)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={editOpen} title="Edit patient" eyebrow="Patient directory" onClose={() => setEditOpen(false)} size="xl">
        <form onSubmit={handleEditPatient} className="space-y-4">
          <div className="rp-grid-2">
            <Field label="Full name" required><Input value={editForm.name} onChange={(event) => updateEdit("name", event.target.value)} required /></Field>
            <Field label="Phone number" required><Input value={editForm.phone} onChange={(event) => updateEdit("phone", event.target.value)} required /></Field>
          </div>
          <div className="rp-grid-3">
            <Field label="Age" required><Input type="number" min={0} value={editForm.age} onChange={(event) => updateEdit("age", event.target.value)} required /></Field>
            <Field label="Gender" required><Select value={editForm.gender} onChange={(event) => updateEdit("gender", event.target.value)}><option>Male</option><option>Female</option><option>Other</option></Select></Field>
            <Field label="Blood group"><Select value={editForm.bloodGroup} onChange={(event) => updateEdit("bloodGroup", event.target.value)}><option value="">Unknown</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bloodGroup) => <option key={bloodGroup}>{bloodGroup}</option>)}</Select></Field>
          </div>
          <Field label="Email"><Input type="email" value={editForm.email} onChange={(event) => updateEdit("email", event.target.value)} /></Field>
          <Field label="Address"><Textarea rows={2} value={editForm.address} onChange={(event) => updateEdit("address", event.target.value)} /></Field>
          <Field label="Department" required><Select value={editForm.department} onChange={(event) => updateEdit("department", event.target.value)}>{departmentOptions.map((department) => <option key={department}>{department}</option>)}</Select></Field>
          <Field label="Reception notes"><Textarea rows={2} value={editForm.notes} onChange={(event) => updateEdit("notes", event.target.value)} /></Field>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="submit" disabled={actionLoading}><Pencil size={16} /> {actionLoading ? "Saving..." : "Save changes"}</Button>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
          </div>
          {saveError && <p role="alert" className="rounded-md border border-alert-100 bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">{saveError}</p>}
        </form>
      </Modal>

      <Modal open={deactivateOpen} title="Deactivate patient" eyebrow="Patient directory" onClose={() => setDeactivateOpen(false)} size="md">
        <p className="text-sm leading-6 text-ink-muted">Deactivate <span className="font-semibold text-ink">{selectedDetails?.name}</span> from this receptionist directory? Their history stays in the database, but they will no longer be treated as an active patient here.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="danger" onClick={handleDeactivatePatient} disabled={actionLoading}><UserX size={16} /> {actionLoading ? "Deactivating..." : "Deactivate patient"}</Button>
          <Button variant="secondary" onClick={() => setDeactivateOpen(false)}>Cancel</Button>
        </div>
        {saveError && <p role="alert" className="mt-4 rounded-md border border-alert-100 bg-alert-50 px-3 py-2 text-xs font-medium text-alert-500">{saveError}</p>}
      </Modal>

      {lastRegistered && (
        <Card className="mb-4 border-brand-100 bg-brand-50/70 !p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CheckCircle2 size={15} className="text-brand-700" />
              {lastRegistered.name} registered successfully.
            </p>
            <div className="rp-uhid-chip">
              <span>UHID</span>
              <Mono>{lastRegistered.uhid}</Mono>
            </div>
          </div>
        </Card>
      )}

      {actionMessage && (
        <Card className="mb-4 border-brand-100 bg-brand-50/70 !p-3">
          <p className="text-sm font-semibold text-ink">{actionMessage}</p>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="rp-input-icon" />
            <Input
              className="!pl-9"
              placeholder="Search by name, UHID or phone"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select value={dept} onChange={(event) => setDept(event.target.value)} className="sm:w-56">
            <option>All</option>
            {departmentOptions.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No matching patients" description="Try a different name, UHID or phone number." />
        ) : (
          <Table columns={["UHID", "Name", "Age / Gender", "Phone", "Department", "Last visit", "Status", "Actions"]}>
            {filtered.map((patient) => (
              <tr key={patient.uhid}>
                <td>
                  <Mono>{patient.uhid}</Mono>
                </td>
                <td className="font-medium text-[var(--rp-ink)]">{patient.name}</td>
                <td>
                  {patient.age} / {patient.gender}
                </td>
                <td>
                  <Mono>{patient.phone}</Mono>
                </td>
                <td>{patient.department}</td>
                <td>{patient.lastVisit}</td>
                <td>
                  <Badge tone={statusTone[patient.status]}>{patient.status}</Badge>
                </td>
                <td>
                  <div className="flex gap-1.5">
                    <button type="button" className="rp-icon-btn" title="View patient details" aria-label={`View ${patient.name}`} onClick={() => void openPatientDetails(patient, "view")} disabled={detailsLoading}>
                      <Eye size={14} />
                    </button>
                    <button type="button" className="rp-icon-btn" title="Edit patient" aria-label={`Edit ${patient.name}`} onClick={() => void openPatientDetails(patient, "edit")} disabled={detailsLoading}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="rp-icon-btn" title={patient.status === "Deactivated" ? "Patient already deactivated" : "Deactivate patient"} aria-label={`Deactivate ${patient.name}`} onClick={() => { setSelectedDetails({ id: patient.backendId ?? "", uhid: patient.uhid, name: patient.name, age: patient.age, dateOfBirth: null, gender: patient.gender, phone: patient.phone, email: "", bloodGroup: "", department: patient.department, address: "", notes: "", workplaceId: patient.workplaceId ?? "", status: patient.status === "Deactivated" ? "Deactivated" : "Active", createdAt: "", updatedAt: "" }); setDeactivateOpen(true); }} disabled={!patient.backendId || patient.status === "Deactivated" || detailsLoading}>
                      <UserX size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

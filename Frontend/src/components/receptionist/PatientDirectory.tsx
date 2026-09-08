"use client";

import * as React from "react";
import { CheckCircle2, Search, UserPlus } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Mono, SectionHeader, Select, Table, Textarea } from "./ui";
import { useReceptionistData } from "./data-context";
import { departments } from "./mock-data";
import { formatReceptionistDate, todayIso } from "./date-utils";

const statusTone: Record<string, "pine" | "amber" | "slate"> = {
  Active: "pine",
  New: "amber",
  Discharged: "slate",
};

export function PatientDirectory() {
  const { addPatient, patients } = useReceptionistData();
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("All");
  const [modalOpen, setModalOpen] = React.useState(false);
  const [lastRegistered, setLastRegistered] = React.useState<null | { uhid: string; name: string }>(null);
  const [form, setForm] = React.useState({
    name: "",
    age: "",
    gender: "Male",
    phone: "",
    email: "",
    address: "",
    department: departments[0],
    bloodGroup: "",
    notes: "",
  });

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
      department: departments[0],
      bloodGroup: "",
      notes: "",
    });
  }

  function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name || !form.age || !form.phone) return;

    const patient = addPatient({
      name: form.name,
      age: Number(form.age),
      gender: form.gender as any,
      phone: form.phone,
      department: form.department,
      bloodGroup: form.bloodGroup || undefined,
      lastVisit: formatReceptionistDate(todayIso()),
      status: "New",
    });

    setLastRegistered({ uhid: patient.uhid, name: patient.name });
    setQuery("");
    setDept("All");
    resetForm();
    setModalOpen(false);
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
              <Input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Ramesh Chandra Verma" required />
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
              {departments.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </Select>
          </Field>

          <Field label="Notes for the doctor" hint="Allergies, ongoing medication, referral details">
            <Textarea rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional" />
          </Field>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit">
              <UserPlus size={16} /> Register patient
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <span className="text-xs text-ink-muted">A UHID is generated after saving.</span>
          </div>
        </form>
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
            {departments.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No matching patients" description="Try a different name, UHID or phone number." />
        ) : (
          <Table columns={["UHID", "Name", "Age / Gender", "Phone", "Department", "Last visit", "Status"]}>
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
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

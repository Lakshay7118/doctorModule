"use client";

import * as React from "react";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, Mono, SectionHeader, Select, Textarea } from "./ui";
import { useReceptionistData } from "./data-context";
import { departments } from "./mock-data";
import { formatReceptionistDate, todayIso } from "./date-utils";

export function PatientRegistration() {
  const { addPatient } = useReceptionistData();
  const [modalOpen, setModalOpen] = React.useState(false);
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
  const [lastRegistered, setLastRegistered] = React.useState<null | { uhid: string; name: string }>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
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
    setModalOpen(false);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - Registration"
        title="Register a new patient"
        description="Capture personal, contact and medical details. A Hospital ID (UHID) is generated automatically on save."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <UserPlus size={16} /> New Patient
          </Button>
        }
      />

      <Modal open={modalOpen} title="Register Patient" eyebrow="Front Desk" onClose={() => setModalOpen(false)} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="rp-grid-2-wide">
        <Card>
          <h2 className="rp-h2">What happens next</h2>
          <ol className="rp-steps">
            <li>A unique Hospital ID (UHID) is generated for the patient.</li>
            <li>The patient is added to the Patient Directory instantly.</li>
            <li>Reception can proceed to book an appointment or check the patient in.</li>
          </ol>
        </Card>

        {lastRegistered ? (
          <Card className="rp-card-success">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-brand-700" />
              <h2 className="rp-h2 !mb-0">Registered</h2>
            </div>
            <p className="rp-sub mb-2">{lastRegistered.name} was registered successfully.</p>
            <div className="rp-uhid-chip">
              <span>UHID</span>
              <Mono>{lastRegistered.uhid}</Mono>
            </div>
          </Card>
        ) : (
          <Card>
            <Badge tone="slate">No patient registered yet this session</Badge>
          </Card>
        )}
      </div>
    </div>
  );
}

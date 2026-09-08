"use client";

import * as React from "react";
import { Siren, Zap } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, Mono, SectionHeader, Select } from "./ui";
import { EmergencyCase, useReceptionistData } from "./data-context";

export function EmergencyReception() {
  const { doctors, emergencyCases, addEmergencyCase } = useReceptionistData();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", age: "", severity: "Serious" as EmergencyCase["severity"], doctor: doctors[0]?.name ?? "" });

  React.useEffect(() => {
    setForm((current) => ({ ...current, doctor: current.doctor || doctors[0]?.name || "" }));
  }, [doctors]);

  function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name || !form.doctor) return;

    addEmergencyCase({
      doctorId: doctors.find((doctor) => doctor.name === form.doctor)?.backendId,
      name: form.name,
      age: form.age || "Unknown",
      severity: form.severity,
      doctor: form.doctor,
    });

    setForm({ name: "", age: "", severity: "Serious", doctor: doctors[0]?.name ?? "" });
    setModalOpen(false);
  }

  const severityTone: Record<EmergencyCase["severity"], "coral" | "amber" | "slate"> = {
    Critical: "coral",
    Serious: "amber",
    Stable: "slate",
  };

  const sorted = [...emergencyCases].sort((a, b) => {
    const order = { Critical: 0, Serious: 1, Stable: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - Emergency"
        title="Emergency reception"
        description="Handle emergency patient registrations, prioritize critical cases, coordinate with emergency doctors and initiate urgent admissions."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="coral">{emergencyCases.filter((item) => item.severity === "Critical").length} critical now</Badge>
            <Button variant="danger" onClick={() => setModalOpen(true)}>
              <Siren size={16} /> New Emergency
            </Button>
          </div>
        }
      />

      <Modal open={modalOpen} title="Register Emergency Arrival" eyebrow="Emergency Reception" onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={handleRegister} className="space-y-4">
          <Field label="Patient name" required hint="Use description if unidentified">
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name or description" required />
          </Field>
          <div className="rp-grid-2">
            <Field label="Approx. age">
              <Input value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))} placeholder="e.g. 40" />
            </Field>
            <Field label="Severity" required>
              <Select value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as EmergencyCase["severity"] }))}>
                <option>Critical</option>
                <option>Serious</option>
                <option>Stable</option>
              </Select>
            </Field>
          </div>
          <Field label="Route to emergency doctor" required>
            <Select value={form.doctor} onChange={(event) => setForm((current) => ({ ...current, doctor: event.target.value }))}>
              {doctors.map((doctor) => (
                <option key={doctor.name} value={doctor.name}>{doctor.name} - {doctor.department}</option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger">
              <Zap size={16} /> Register and notify doctor
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Card className="rp-card-alert">
        <div className="mb-3 flex items-center gap-2">
          <Siren size={16} className="text-alert-500" />
          <h2 className="rp-h2 !mb-0">Triage priority list</h2>
        </div>
        <ul className="rp-list">
          {sorted.map((item) => (
            <li key={item.id} className="rp-list-row">
              <Mono>{item.id}</Mono>
              <div className="min-w-0 flex-1">
                <p className="rp-list-title">{item.name}</p>
                <p className="rp-list-sub">{item.doctor} - arrived {item.arrivedAt}</p>
              </div>
              <Badge tone={severityTone[item.severity]}>{item.severity}</Badge>
            </li>
          ))}
          {sorted.length === 0 && <p className="rp-sub">No emergency cases currently active.</p>}
        </ul>
      </Card>
    </div>
  );
}

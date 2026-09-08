"use client";

import * as React from "react";
import { ArrowRight, TicketCheck } from "lucide-react";
import { Badge, Button, Card, Field, Modal, Mono, SectionHeader, Select } from "./ui";
import { useReceptionistData } from "./data-context";

const statusTone: Record<string, "pine" | "amber" | "slate"> = {
  Waiting: "amber",
  "In Consultation": "pine",
  Completed: "slate",
};

export function CheckIn() {
  const { doctors, patients, queue, checkIn, advanceQueueStatus } = useReceptionistData();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    uhid: patients[0]?.uhid ?? "",
    doctor: doctors[0]?.name ?? "",
  });
  const [issued, setIssued] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm((current) => ({
      ...current,
      uhid: current.uhid || patients[0]?.uhid || "",
      doctor: current.doctor || doctors[0]?.name || "",
    }));
  }, [doctors, patients]);

  function handleCheckIn(event: React.FormEvent) {
    event.preventDefault();
    const patient = patients.find((item) => item.uhid === form.uhid);
    if (!patient) return;

    const doctor = doctors.find((item) => item.name === form.doctor);
    if (!doctor) return;
    const entry = checkIn({
      patient: patient.name,
      doctor: doctor.name,
      department: doctor.department,
      checkedInAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      status: "Waiting",
    });
    setIssued(entry.token);
    setModalOpen(false);
  }

  function nextStatus(status: "Waiting" | "In Consultation" | "Completed") {
    if (status === "Waiting") return "In Consultation" as const;
    if (status === "In Consultation") return "Completed" as const;
    return status;
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Front desk - Check-in"
        title="Patient check-in"
        description="Mark patient arrivals, assign queue positions, generate consultation tokens and notify doctors."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <TicketCheck size={16} /> Check In Patient
          </Button>
        }
      />

      <Modal open={modalOpen} title="Check In Patient" eyebrow="Queue Management" onClose={() => setModalOpen(false)} size="lg">
        <form onSubmit={handleCheckIn} className="space-y-4">
          <Field label="Patient" required>
            <Select value={form.uhid} onChange={(event) => setForm((current) => ({ ...current, uhid: event.target.value }))}>
              {patients.map((patient) => (
                <option key={patient.uhid} value={patient.uhid}>{patient.name} - {patient.uhid}</option>
              ))}
            </Select>
          </Field>
          <Field label="Consulting doctor" required>
            <Select value={form.doctor} onChange={(event) => setForm((current) => ({ ...current, doctor: event.target.value }))}>
              {doctors.map((doctor) => (
                <option key={doctor.name} value={doctor.name}>{doctor.name} - {doctor.department}</option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">
              <TicketCheck size={16} /> Generate token
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {issued && (
        <Card className="mb-5 rp-card-success">
          <div className="rp-uhid-chip">
            <span>Token issued</span>
            <Mono>{issued}</Mono>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="rp-h2 !mb-0">Live queue</h2>
          <Badge tone="amber">{queue.filter((item) => item.status === "Waiting").length} waiting</Badge>
        </div>
        <ul className="rp-list">
          {queue.map((entry) => (
            <li key={entry.token} className="rp-list-row">
              <Mono>{entry.token}</Mono>
              <div className="min-w-0 flex-1">
                <p className="rp-list-title">{entry.patient}</p>
                <p className="rp-list-sub">{entry.doctor} - checked in {entry.checkedInAt}</p>
              </div>
              <Badge tone={statusTone[entry.status]}>{entry.status}</Badge>
              {entry.status !== "Completed" && (
                <button
                  className="rp-icon-btn"
                  title={`Move to ${nextStatus(entry.status)}`}
                  onClick={() => advanceQueueStatus(entry.token, nextStatus(entry.status))}
                >
                  <ArrowRight size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Phone, Droplet, Stethoscope, FilePlus2, FlaskConical, CalendarClock } from "lucide-react";
import { ConsultationForm } from "@/components/doctor-consultation-form";
import { LabOrderIssueModal } from "@/components/lab-order-issue-modal";
import { PrescriptionIssueModal } from "@/components/prescription-issue-modal";
import { Card, SectionHeading, Avatar, Pill, OrderStatusBadge, EmptyState, Modal, Skeleton } from "@/components/ui";
import { useDoctorWorkflow } from "@/lib/doctor-workflow-context";
import { ConsultationNote } from "@/lib/types";

const tagTone: Record<string, "brand" | "clay" | "alert" | "sage"> = {
  New: "brand",
  "Follow-up": "clay",
  Critical: "alert",
  "Shared-care": "sage",
};

export default function PatientDetail({ params }: { params: { id: string } }) {
  const {
    appointments,
    diagnoses,
    doctors: doctorRows,
    followUps,
    isLoadingWorkflow,
    labOrders,
    patients,
    prescriptions,
    radiologyOrders,
  } = useDoctorWorkflow();
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [labOrderOpen, setLabOrderOpen] = useState(false);
  const patient = patients.find((item) => item.id === params.id);
  const consultationNotes: ConsultationNote[] = [];

  if (isLoadingWorkflow) {
    return (
      <div>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="mt-3 h-4 w-96 max-w-full" />
              <Skeleton className="mt-2 h-3 w-72 max-w-full" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="vitals-strip mb-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="vitals-cell">
              <Skeleton className="h-3 w-24 bg-white/15" />
              <Skeleton className="mt-3 h-8 w-20 bg-white/20" />
            </div>
          ))}
        </div>
        <Card className="mb-6">
          <Skeleton className="h-5 w-36" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[88px_1fr] gap-3 rounded-md border border-line bg-paper px-3 py-2">
                <Skeleton className="h-3 w-16" />
                <div>
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <Skeleton className="mb-4 h-5 w-44" />
                <Skeleton className="mb-3 h-4 w-full" />
                <Skeleton className="mb-3 h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <Skeleton className="mb-4 h-5 w-36" />
                <Skeleton className="mb-3 h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <EmptyState
        title="Patient not found"
        description="The selected patient record could not be loaded from the database."
        action={
          <Link href="/doctor/patients" className="btn-primary">
            Back to patients
          </Link>
        }
      />
    );
  }

  const patientDx = diagnoses.filter((d) => d.patientId === patient.id);
  const patientRx = prescriptions.filter((r) => r.patientId === patient.id);
  const patientLabs = labOrders.filter((l) => l.patientId === patient.id);
  const patientRadiology = radiologyOrders.filter((r) => r.patientId === patient.id);
  const patientFollowUps = followUps.filter((f) => f.patientId === patient.id);
  const patientAppointments = appointments.filter((a) => a.patientId === patient.id);
  const patientNotes = consultationNotes.filter((note) => note.patientId === patient.id);
  const patientModalRows = [patient];
  const doctor = doctorRows.find((item) => item.id === patient.primaryDoctorId);
  const patientTimeline = [
    ...patientAppointments.map((item) => ({
      id: `appointment-${item.id}`,
      date: item.date,
      title: item.reason,
      meta: `Appointment - ${item.status}`,
      href: `/doctor/consultation?patient=${patient.id}&appointment=${item.id}`,
    })),
    ...(patient.latestVitals
      ? [
          {
            id: "latest-vitals",
            date: patient.latestVitals.recordedAt.slice(0, 10),
            title: `Vitals: BP ${patient.latestVitals.bp}, SpO2 ${patient.latestVitals.spo2}%`,
            meta: "Vitals",
            href: "/doctor/vitals",
          },
        ]
      : []),
    ...patientNotes.map((item) => ({
      id: `note-${item.id}`,
      date: item.date,
      title: item.chiefComplaint || item.diagnosis || "Consultation note",
      meta: `Consultation - ${item.status}`,
      href: `/doctor/consultation?patient=${patient.id}`,
    })),
    ...patientDx.map((item) => ({
      id: `diagnosis-${item.id}`,
      date: item.diagnosedOn,
      title: item.description,
      meta: `Diagnosis - ${item.icdCode}`,
      href: "/doctor/diagnosis",
    })),
    ...patientRx.map((item) => ({
      id: `rx-${item.id}`,
      date: item.date,
      title: item.medicines.map((medicine) => medicine.name).join(", "),
      meta: `Prescription - ${item.status}`,
      href: `/doctor/prescriptions?patient=${patient.id}`,
    })),
    ...patientLabs.map((item) => ({
      id: `lab-${item.id}`,
      date: item.orderedOn,
      title: item.testName,
      meta: `Lab - ${item.status}`,
      href: `/doctor/lab-orders?patient=${patient.id}`,
    })),
    ...patientRadiology.map((item) => ({
      id: `radiology-${item.id}`,
      date: item.orderedOn,
      title: `${item.imagingType} - ${item.bodyRegion}`,
      meta: `Radiology - ${item.status}`,
      href: `/doctor/radiology-orders?patient=${patient.id}`,
    })),
    ...patientFollowUps.map((item) => ({
      id: `follow-up-${item.id}`,
      date: item.dueDate,
      title: item.reason,
      meta: `Follow-up - ${item.status}`,
      href: "/doctor/follow-up",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Avatar initials={patient.avatarInitials} size={56} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl text-ink">{patient.name}</h1>
              {patient.tags?.map((t) => (
                <Pill key={t} tone={tagTone[t]}>
                  {t}
                </Pill>
              ))}
            </div>
            <p className="text-sm text-ink-muted mt-1">
              {patient.age} yrs · {patient.gender} · <span className="font-mono">{patient.mrn}</span> · Blood group{" "}
              {patient.bloodGroup}
            </p>
            <p className="text-xs text-ink-muted mt-1 flex items-center gap-1">
              <Phone size={12} /> {patient.phone} &nbsp;·&nbsp; Primary doctor: {doctor?.name ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setConsultationOpen(true)} className="btn-primary">
            <Stethoscope size={15} /> Start Consultation
          </button>
          <button type="button" onClick={() => setPrescriptionOpen(true)} className="btn-secondary">
            <FilePlus2 size={15} /> New Rx
          </button>
          <button type="button" onClick={() => setLabOrderOpen(true)} className="btn-secondary">
            <FlaskConical size={15} /> Order Test
          </button>
        </div>
      </div>

      {patient.allergies.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-card border border-alert-100 bg-alert-50 px-4 py-3 mb-6">
          <AlertTriangle size={16} className="text-alert-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-alert-500">Allergy alert</p>
            <p className="text-xs text-ink-soft mt-0.5">
              {patient.allergies.map((a) => `${a.substance} (${a.severity} — ${a.reaction})`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {patient.latestVitals && (
        <div className="vitals-strip mb-6">
          <div className="vitals-cell">
            <span className="vitals-label">Blood Pressure</span>
            <span className="vitals-value">
              {patient.latestVitals.bp}
              <span className="vitals-unit">mmHg</span>
            </span>
          </div>
          <div className="vitals-cell">
            <span className="vitals-label">Pulse</span>
            <span className="vitals-value">
              {patient.latestVitals.pulse}
              <span className="vitals-unit">bpm</span>
            </span>
          </div>
          <div className="vitals-cell">
            <span className="vitals-label">Temp</span>
            <span className="vitals-value">
              {patient.latestVitals.temp}
              <span className="vitals-unit">°F</span>
            </span>
          </div>
          <div className="vitals-cell">
            <span className="vitals-label">SpO2</span>
            <span className="vitals-value">
              {patient.latestVitals.spo2}
              <span className="vitals-unit">%</span>
            </span>
          </div>
          <div className="vitals-cell">
            <span className="vitals-label">Weight / BMI</span>
            <span className="vitals-value">
              {patient.latestVitals.weight}
              <span className="vitals-unit">kg · {patient.latestVitals.bmi}</span>
            </span>
          </div>
        </div>
      )}

      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Patient Journey</p>
            <h2 className="font-display text-lg text-ink">Timeline</h2>
          </div>
          <Pill tone="brand">{patientTimeline.length} events</Pill>
        </div>
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {patientTimeline.map((item) => (
            <Link key={item.id} href={item.href} className="grid grid-cols-[88px_1fr] gap-3 rounded-md border border-line bg-paper px-3 py-2 hover:bg-brand-50/60">
              <span className="font-mono text-[11px] text-ink-muted">{item.date}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                <span className="block text-[11px] text-ink-faint">{item.meta}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <h2 className="font-display text-lg text-ink mb-3">Diagnoses &amp; ICD History</h2>
            {patientDx.length === 0 ? (
              <p className="text-sm text-ink-muted">No diagnoses on record.</p>
            ) : (
              <div className="space-y-2.5">
                {patientDx.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 border-b border-line/70 pb-2.5 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-soft">{d.description}</p>
                      <p className="text-xs text-ink-faint font-mono mt-0.5">{d.icdCode} · diagnosed {d.diagnosedOn}</p>
                    </div>
                    <Pill tone={d.status === "Chronic" ? "clay" : d.status === "Active" ? "alert" : "sage"}>{d.status}</Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-display text-lg text-ink mb-3">Prescriptions</h2>
            {patientRx.length === 0 ? (
              <p className="text-sm text-ink-muted">No prescriptions yet.</p>
            ) : (
              <div className="space-y-4">
                {patientRx.map((rx) => (
                  <div key={rx.id} className="border-b border-line/70 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-ink-muted">{rx.date}</p>
                      <Pill tone={rx.status === "Active" ? "brand" : "neutral"}>{rx.status}</Pill>
                    </div>
                    <ul className="text-sm text-ink-soft space-y-1">
                      {rx.medicines.map((m) => (
                        <li key={m.id}>
                          <span className="font-medium">{m.name}</span> {m.dosage} — {m.frequency}, {m.duration}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-display text-lg text-ink mb-3">Consultation History</h2>
            {patientNotes.length === 0 ? (
              <p className="text-sm text-ink-muted">No consultation notes yet.</p>
            ) : (
              <div className="space-y-3">
                {patientNotes.map((n) => (
                  <div key={n.id} className="border-b border-line/70 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-ink">{n.chiefComplaint || "Consultation"}</p>
                      <Pill tone={n.status === "Finalized" ? "sage" : "clay"}>{n.status}</Pill>
                    </div>
                    <p className="text-xs text-ink-muted">{n.date}</p>
                    {n.diagnosis && <p className="text-sm text-ink-soft mt-1">{n.diagnosis}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-display text-lg text-ink mb-3">Laboratory Orders</h2>
            <div className="space-y-2.5">
              {patientLabs.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-soft truncate">{l.testName}</p>
                    <p className="text-[11px] text-ink-faint">{l.orderedOn}</p>
                  </div>
                  <OrderStatusBadge status={l.status} />
                </div>
              ))}
              {patientLabs.length === 0 && <p className="text-sm text-ink-muted">No lab orders.</p>}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg text-ink mb-3">Radiology Orders</h2>
            <div className="space-y-2.5">
              {patientRadiology.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-soft truncate">
                      {r.imagingType} · {r.bodyRegion}
                    </p>
                    <p className="text-[11px] text-ink-faint">{r.orderedOn}</p>
                  </div>
                  <OrderStatusBadge status={r.status} />
                </div>
              ))}
              {patientRadiology.length === 0 && <p className="text-sm text-ink-muted">No radiology orders.</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg text-ink">Follow-ups</h2>
              <Link href="/doctor/follow-up" className="btn-ghost text-xs">
                <CalendarClock size={13} /> Manage
              </Link>
            </div>
            <div className="space-y-2.5">
              {patientFollowUps.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2">
                  <p className="text-sm text-ink-soft">{f.reason}</p>
                  <Pill tone={f.status === "Overdue" ? "alert" : f.status === "Completed" ? "sage" : "clay"}>
                    {f.status}
                  </Pill>
                </div>
              ))}
              {patientFollowUps.length === 0 && <p className="text-sm text-ink-muted">No follow-ups scheduled.</p>}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg text-ink mb-3">Appointment History</h2>
            <div className="space-y-2.5">
              {patientAppointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-ink-soft">{a.date}</p>
                    <p className="text-[11px] text-ink-faint">{a.reason}</p>
                  </div>
                  <Pill tone="neutral">{a.status}</Pill>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={consultationOpen}
        title="Start Consultation"
        eyebrow={patient.name}
        onClose={() => setConsultationOpen(false)}
        size="xl"
      >
        <ConsultationForm
          patients={patientModalRows}
          preselectedPatientId={patient.id}
          showHeading={false}
          prescriptionMode="modal"
          labOrderMode="modal"
        />
      </Modal>
      <PrescriptionIssueModal
        open={prescriptionOpen}
        onClose={() => setPrescriptionOpen(false)}
        patients={patientModalRows}
        preselectedPatientId={patient.id}
      />
      <LabOrderIssueModal
        open={labOrderOpen}
        onClose={() => setLabOrderOpen(false)}
        patients={patientModalRows}
        preselectedPatientId={patient.id}
      />
    </div>
  );
}
